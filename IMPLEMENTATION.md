# Implementation Details (WIP)

## WebExtension
### Permissions
|Permission|Description|Usage|
|--|--|--|
|`browser.history`|Access browsing history|When opening receiver selection popup windows, the history log is polluted unless these entries are removed.|
|`menus`|N/A|Display context menus for casting on pages/media, and whitelist menus on the toolbar button.|
|`nativeMessaging`|Exchange messages with programs other than Firefox|Allows communciation with the bridge.|
|`notifications`|Display notifications to you|Show notifications if a bridge issue is found on startup.|
|`storage`|N/A|Store options data.|
|`tabs`|Access browser tabs|Execute scripts within a sender application's tab content script context (possibly unnecessary due to host permissions).|
|`webNavigation`|Access browser activity during navigation|Get URL of frame to determine available cast media types.|
|`webRequest`|N/A|Intercept and redirect Cast SDK requests.|
|`<all_urls>`|Acess your data for all websites|Wildcard host permission (may want to switch to optional host permissions).|
