// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const {
  TimexProperty
} = require("@microsoft/recognizers-text-data-types-timex-expression");
const { MessageFactory, InputHints, CardFactory } = require("botbuilder");
const { LuisRecognizer } = require("botbuilder-ai");
const {
  ComponentDialog,
  DialogSet,
  DialogTurnStatus,
  TextPrompt,
  WaterfallDialog
} = require("botbuilder-dialogs");

const MAIN_WATERFALL_DIALOG = "mainWaterfallDialog";

const speakers = require("../data/speakers");

class MainDialog extends ComponentDialog {
  constructor(luisRecognizer, bookingDialog) {
    super("MainDialog");

    if (!luisRecognizer)
      throw new Error(
        "[MainDialog]: Missing parameter 'luisRecognizer' is required"
      );
    this.luisRecognizer = luisRecognizer;

    if (!bookingDialog)
      throw new Error(
        "[MainDialog]: Missing parameter 'bookingDialog' is required"
      );

    // Define the main dialog and its related components.
    // This is a sample "book a flight" dialog.
    this.addDialog(new TextPrompt("TextPrompt"))
      .addDialog(bookingDialog)
      .addDialog(
        new WaterfallDialog(MAIN_WATERFALL_DIALOG, [
          this.introStep.bind(this),
          this.actStep.bind(this),
          this.finalStep.bind(this)
        ])
      );

    this.initialDialogId = MAIN_WATERFALL_DIALOG;
  }

  /**
   * The run method handles the incoming activity (in the form of a TurnContext) and passes it through the dialog system.
   * If no dialog is active, it will start the default dialog.
   * @param {*} turnContext
   * @param {*} accessor
   */
  async run(turnContext, accessor) {
    const dialogSet = new DialogSet(accessor);
    dialogSet.add(this);

    const dialogContext = await dialogSet.createContext(turnContext);
    const results = await dialogContext.continueDialog();
    if (results.status === DialogTurnStatus.empty) {
      await dialogContext.beginDialog(this.id);
    }
  }

  /**
   * First step in the waterfall dialog. Prompts the user for a command.
   * Currently, this expects a booking request, like "book me a flight from Paris to Berlin on march 22"
   * Note that the sample LUIS model will only recognize Paris, Berlin, New York and London as airport cities.
   */
  async introStep(stepContext) {
    if (!this.luisRecognizer.isConfigured) {
      const messageText =
        "NOTE: LUIS is not configured. To enable all capabilities, add `LuisAppId`, `LuisAPIKey` and `LuisAPIHostName` to the .env file.";
      await stepContext.context.sendActivity(
        messageText,
        null,
        InputHints.IgnoringInput
      );
      return await stepContext.next();
    }

    const messageText = stepContext.options.restartMsg
      ? stepContext.options.restartMsg
      : "¿En qué te puedo ayudar?";
    const promptMessage = MessageFactory.text(
      messageText,
      messageText,
      InputHints.ExpectingInput
    );
    return await stepContext.prompt("TextPrompt", { prompt: promptMessage });
  }

  /**
   * Second step in the waterfall.  This will use LUIS to attempt to extract the origin, destination and travel dates.
   * Then, it hands off to the bookingDialog child dialog to collect any remaining details.
   */
  async actStep(stepContext) {
    const listEventsDetails = {};

    if (!this.luisRecognizer.isConfigured) {
      // LUIS is not configured, we just run the listEventsDialog path.
      return await stepContext.beginDialog(
        "listEventsDialog",
        listEventsDetails
      );
    }

    // Call LUIS and gather any potential booking details. (Note the TurnContext has the response to the prompt)
    const luisResult = await this.luisRecognizer.executeLuisQuery(
      stepContext.context
    );
    switch (LuisRecognizer.topIntent(luisResult)) {
      case "list_events":
        // Extract the values for the composite entities from the LUIS result.
        const eventsEntities = this.luisRecognizer.getEntityEvents(luisResult);
        const listEventsDetails = {
          topic: eventsEntities.eventTopic,
          date: eventsEntities.eventDate
        };

        listEventsDetails.date = this.luisRecognizer.getEventsListDate(
          luisResult
        );

        const speaks = this.getSpeaksByDate(
          listEventsDetails.date,
          listEventsDetails.topic
		);

		const speakCards = {};
		if (speaks.length == 0) {
			speakCards = this.getResultCard();
		} else {
			speakCards = this.getSpeaksCards(speaks);
		}

        const reply = MessageFactory.carousel(speakCards);
        await stepContext.context.sendActivity(reply);
        break;

      case "list_speakers":
        const listSpeakersMessageText = "TODO: Mostrar speakers";
        await stepContext.context.sendActivity(
          listSpeakersMessageText,
          listSpeakersMessageText,
          InputHints.IgnoringInput
        );
        break;

      default:
        // Catch all for unhandled intents
        console.log(`Intent was ${LuisRecognizer.topIntent(luisResult)}`);

        const didntUnderstandMessageText =
          "Perdón, no pude entender lo que quisiste poner. Podrias internarlo con otras palabras, por favor?";
        await stepContext.context.sendActivity(
          didntUnderstandMessageText,
          didntUnderstandMessageText,
          InputHints.IgnoringInput
        );
    }

    return await stepContext.next();
  }

  /**
   * This is the final step in the main waterfall dialog.
   * It wraps up the sample "book a flight" interaction with a simple confirmation.
   */
  async finalStep(stepContext) {
    // Restart the main dialog with a different message the second time around
    return await stepContext.replaceDialog(this.initialDialogId, {
      restartMsg: "¿En qué más te puedo ayudar?"
    });
  }

  getSpeaksByDate(date, topic) {
    let selectedSpeaks = speakers;
    if (date) {
      selectedSpeaks = selectedSpeaks.filter(speak => speak.date === date);
    }
    if (topic) {
      selectedSpeaks = selectedSpeaks.filter(speak =>
        speak.tag.includes(topic.toLowerCase())
      );
    }

    return selectedSpeaks;
  }

  getSpeaksCards(speaks) {
    return speaks.map(speak => {
      return CardFactory.heroCard(
        speak.title,
        speak.description,
        ["https://avatars2.githubusercontent.com/u/51052168?s=200&v=4"],
        ["Ver más"]
      );
    });
  }

  getResultCard() {
	return CardFactory.heroCard(
        "Lo sentimos! :(",
        "No pudimos encontrar ningún resultado con los parámetros solicitados. Por favor, intentalo nuevamente con otras palabras."
      );
  }
}

module.exports.MainDialog = MainDialog;
