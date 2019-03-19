"use strict";

import Image from "../../cast/classes/Image";
import Session from "../../cast/classes/Session";


export default class ApplicationMetadata {
    public applicationId: string;
    public images: Image[];
    public name: string;
    public namespaces: string[];

    constructor (sessionObj: Session) {
        this.applicationId = sessionObj.appId;
        this.images = sessionObj.appImages;
        this.name = sessionObj.displayName;

        // Convert [{ name: <ns> }, ...] to [ <ns>, ... ]
        this.namespaces = sessionObj.namespaces.map(
                namespaceObj => namespaceObj.name);
    }
}
