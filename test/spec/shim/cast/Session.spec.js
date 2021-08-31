"use strict";

describe("chrome.cast.Session", () => {
    it("should have all properties", async () => {
        const session = new chrome.cast.Session();

        expect(session.appId).toBe(undefined);
        expect(session.appImages).toBe(undefined);
        expect(session.displayName).toBe(undefined);
        expect(session.media).toEqual([]);
        expect(session.namespaces).toEqual([]);
        expect(session.receiver).toBe(undefined);
        expect(session.senderApps).toEqual([]);
        expect(session.sessionId).toBe(undefined);
        expect(session.status).toBe("connected");
        expect(session.statusText).toBe(null);
        expect(session.transportId).toBe("");
    });

    it("should have expected assigned properties", async () => {
        const session = new chrome.cast.Session(
            "__sessionId",
            "__appId",
            "__displayName",
            [new chrome.cast.Image("http://example.com")],
            new chrome.cast.Receiver("__label", "__friendlyName")
        );

        expect(session.appId).toBe("__appId");
        expect(session.appImages).toEqual(
            jasmine.arrayContaining([
                jasmine.objectContaining({ url: "http://example.com" })
            ])
        );
        expect(session.displayName).toBe("__displayName");
        expect(session.receiver).toEqual(jasmine.any(chrome.cast.Receiver));
        expect(session.sessionId).toBe("__sessionId");
    });
});
