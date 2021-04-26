"use strict";

import { UserAction } from "../enums";


export default class UserActionState {
    public customData: any = null;

    constructor(
            public userAction: UserAction) {}
}
