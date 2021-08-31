"use strict";

describe("chrome.cast.Error", () => {
    it("should have all properties", async () => {
        const error = new chrome.cast.Error();

        expect(typeof error.code).toBe("undefined");
        expect(error.description).toBe(null);
        expect(error.details).toBe(null);
    });

    it("should have expected assigned properties", async () => {
        const error = new chrome.cast.Error(
            chrome.cast.ErrorCode.CANCEL,
            "testErrorDescription",
            { testErrorDetails: "testErrorDetails" }
        );

        expect(error.code).toBe("cancel");
        expect(error.description).toBe("testErrorDescription");
        expect(error.details).toEqual({ testErrorDetails: "testErrorDetails" });
    });
});
