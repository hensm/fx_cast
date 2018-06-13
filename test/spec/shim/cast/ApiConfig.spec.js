"use strict";

const { create } = require("../../../driver");

describe("chrome.cast.ApiConfig", () => {
    let driver;

    beforeAll(async () => {
        driver = await create();
    });
    afterAll(() => {
        driver.quit();
    })


    it("should have all properties", async () => {
        const [ typeof_receiverListener
              , typeof_sessionListener
              , typeof_sessionRequest
              , apiConfig ] = await driver.executeScript(() => {

            const apiConfig = new chrome.cast.ApiConfig();

            return [
                typeof apiConfig.receiverListener
              , typeof apiConfig.sessionListener
              , typeof apiConfig.sessionRequest
              , apiConfig
            ];
        });

        expect(apiConfig.additionalSessionRequests).toEqual([]);
        expect(apiConfig.autoJoinPolicy).toBe("tab_and_origin_scoped");
        expect(apiConfig.customDialLaunchCallback).toBe(null);
        expect(apiConfig.defaultActionPolicy).toBe("create_session");
        expect(apiConfig.invisibleSender).toBe(false);
        expect(typeof_receiverListener).toBe("undefined");
        expect(typeof_sessionListener).toBe("undefined");
        expect(typeof_sessionRequest).toBe("undefined");
    });

    it("should have expected assigned properties", async () => {
        const [ typeof_sessionListener
              , typeof_receiverListener
              , apiConfig ] = await driver.executeScript(() => {

            const sessionRequest = new chrome.cast.SessionRequest(
                    chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID);

            function sessionListener () {}
            function receiverListener () {}

            const apiConfig = new chrome.cast.ApiConfig(
                    sessionRequest
                  , sessionListener
                  , receiverListener
                  , chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED
                  , chrome.cast.DefaultActionPolicy.CAST_THIS_TAB);

            return [
                typeof sessionListener
              , typeof receiverListener
              , apiConfig
            ];
        });

        expect(typeof_sessionListener).toBe("function");
        expect(typeof_receiverListener).toBe("function");
        expect(apiConfig.autoJoinPolicy).toBe("origin_scoped");
        expect(apiConfig.defaultActionPolicy).toBe("cast_this_tab");
    });
});
