/// <reference types="node" />

declare module "bplist-creator" {
    import Buffer from "buffer";

    function bplist(dicts: object): Buffer;
    export = bplist;

    namespace bplist {
        export class Real {
            public value: number;
            constructor(value: number);
        }
    }
}
