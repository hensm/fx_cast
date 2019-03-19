"use strict";

import { AutoJoinPolicy } from "../../cast/enums";

export default class CastOptions {
    public autoJoinPolicy: string = AutoJoinPolicy.TAB_AND_ORIGIN_SCOPED;
    public language: string = null;
    public receiverApplicationId: string = null;
    public resumeSavedSession: boolean = true;

    constructor (options: CastOptions = ({} as CastOptions)) {
        if (options.autoJoinPolicy) {
            this.autoJoinPolicy = options.autoJoinPolicy;
        }
        if (options.language) {
            this.language = options.language;
        }
        if (options.receiverApplicationId) {
            this.receiverApplicationId = options.receiverApplicationId;
        }
        if (options.resumeSavedSession) {
            this.resumeSavedSession = options.resumeSavedSession;
        }
    }
}
