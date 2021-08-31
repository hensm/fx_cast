"use strict";

describe("chrome.cast.ApiConfig", () => {
    it("should have all properties", async () => {
        const apiConfig = new chrome.cast.ApiConfig();

        expect(apiConfig.additionalSessionRequests).toEqual([]);
        expect(apiConfig.autoJoinPolicy).toBe("tab_and_origin_scoped");
        expect(apiConfig.customDialLaunchCallback).toBe(null);
        expect(apiConfig.defaultActionPolicy).toBe("create_session");
        expect(apiConfig.invisibleSender).toBe(false);
        expect(typeof apiConfig.receiverListener).toBe("undefined");
        expect(typeof apiConfig.sessionListener).toBe("undefined");
        expect(typeof apiConfig.sessionRequest).toBe("undefined");
    });

    it("should have expected assigned properties", async () => {
        const sessionRequest = new chrome.cast.SessionRequest(
            chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID
        );

        function sessionListener() {}
        function receiverListener() {}

        const apiConfig = new chrome.cast.ApiConfig(
            sessionRequest,
            sessionListener,
            receiverListener,
            chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
            chrome.cast.DefaultActionPolicy.CAST_THIS_TAB
        );

        expect(typeof apiConfig.sessionListener).toBe("function");
        expect(typeof apiConfig.receiverListener).toBe("function");
        expect(apiConfig.autoJoinPolicy).toBe("origin_scoped");
        expect(apiConfig.defaultActionPolicy).toBe("cast_this_tab");
    });
});
