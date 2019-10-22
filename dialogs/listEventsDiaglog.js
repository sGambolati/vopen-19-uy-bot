const { DateResolverDialog } = require('./dateResolverDialog');
const { ConfirmPrompt, TextPrompt, WaterfallDialog } = require('botbuilder-dialogs');
const { ComponentDialog } = require('botbuilder-dialogs');

const DATE_RESOLVER_DIALOG = 'dateResolverDialog';
const TEXT_PROMPT = 'textPrompt';
const WATERFALL_DIALOG = 'waterfallDialog';

class ListEventsDialog extends ComponentDialog {
    constructor(id) {
        super(id || 'listEventsDialog');

        this.addDialog(new TextPrompt(TEXT_PROMPT))
            // .addDialog(new ConfirmPrompt(CONFIRM_PROMPT))
            .addDialog(new DateResolverDialog(DATE_RESOLVER_DIALOG))
            .addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
                this.topicStep.bind(this),
                // this.originStep.bind(this),
                // this.travelDateStep.bind(this),
                // this.confirmStep.bind(this),
                // this.finalStep.bind(this)
            ]));

        this.initialDialogId = WATERFALL_DIALOG;
    }

    async topicStep(stepContext) {
        const listEventDetails = stepContext.options;

        if (!listEventDetails.destination) {
            const messageText = 'De que tema?';
            const msg = MessageFactory.text(messageText, messageText, InputHints.ExpectingInput);
            return await stepContext.prompt(TEXT_PROMPT, { prompt: msg });
        }
        return await stepContext.next(bookingDetails.destination);
    }
}

module.exports.ListEventsDialog = ListEventsDialog;