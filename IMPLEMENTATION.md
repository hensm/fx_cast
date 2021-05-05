# Implementation Details (WIP)

## WebExtension
### Permissions
|Permission|Usage|
|--|--|
|`browser.history`|When opening receiver selection popup windows, the history log is polluted unless these entries are removed.|
|`menus`|Display context menus for casting on pages/media, and whitelist menus on the toolbar button.|
|`nativeMessaging`|Allows communciation with the bridge.|
|`notifications`|Show notifications if a bridge issue is found on startup.|
|`storage`|Store options data.|
|`tabs`|Execute scripts within a sender application's tab content script context(possibly unnecessary due to host permissions).|
|`webNavigation`|Get URL of frame to determine available cast media types.|
|`webRequest`|Intercept and redirect Cast SDK requests.|
|`<all_urls>`|Wildcard host permission (may want to switch to optional host permissions).|
