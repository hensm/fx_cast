# Contributing

Contributions welcome.

Implementation notes are at [IMPLEMENTATION.md](IMPLEMENTATION.md).
If you're unsure about anything, feel free to ask.

Just submit a PR for small changes (bugfixes, typos, etc...). Comment first on existing
issues if you're going to work on something to avoid duplication of effort.

Submit an issue for new features before submitting a PR.

## Bug Reports

Follow the bug report issue template and provide as much info as possible. Logs can be found in various locations depending on the component at fault:

-   https://developer.mozilla.org/en-US/docs/Tools/Web_Console
-   https://developer.mozilla.org/en-US/docs/Tools/Browser_Console
-   https://extensionworkshop.com/documentation/develop/debugging/

## Compatibility Reports

Compatibility reports are always helpful. They're tracked in a separate repository, so go to [@hensm/fx_cast-compat](https://github.com/hensm/fx_cast-compat) and use the "Compatibility Report" issue template. Ensure you have a working environment and that the site is in the whitelist (check options page).

## Localizations

Either fork and edit the messages files manually or to easily add/edit localizations, use the web-ext-translator tool:
https://lusito.github.io/web-ext-translator/?gh=https://github.com/hensm/fx_cast/

<details>
    <summary>Missing/outdated strings:</summary>

- `de`

    - `optionsMirroringCategoryName`
    - `optionsMirroringCategoryDescription`
    - `optionsMirroringEnabled`
    - `optionsMirroringAppId`
    - `optionsBridgeCompatible`
    - `optionsBridgeLikelyCompatible`
    - `optionsBridgeIncompatible`
    - `optionsSiteWhitelistCategoryName`
    - `optionsSiteWhitelistCategoryDescription`
    - `optionsSiteWhitelistEnabled`
    - `optionsSiteWhitelistEnabledDescription`
    - `optionsSiteWhitelistContent`
    - `optionsSiteWhitelistBasicView`
    - `optionsSiteWhitelistRawView`
    - `optionsSiteWhitelistSaveRaw`
    - `optionsSiteWhitelistAddItem`
    - `optionsSiteWhitelistUserAgent`
    - `optionsSiteWhitelistEditItem`
    - `optionsSiteWhitelistRemoveItem`
    - `optionsSiteWhitelistInvalidMatchPattern`
    - `popupWhitelistNotWhitelisted`
    - `popupWhitelistAddToWhitelist`
    - `popupMediaTypeAppNotFound`
    - `popupCastMenuTitle`
    - `popupStopMenuTitle`

- `es`

    - `optionsSiteWhitelistCategoryName`
    - `optionsSiteWhitelistCategoryDescription`
    - `optionsSiteWhitelistEnabled`
    - `optionsSiteWhitelistEnabledDescription`
    - `optionsSiteWhitelistContent`
    - `optionsSiteWhitelistBasicView`
    - `optionsSiteWhitelistRawView`
    - `optionsSiteWhitelistSaveRaw`
    - `optionsSiteWhitelistAddItem`
    - `optionsSiteWhitelistUserAgent`
    - `optionsSiteWhitelistEditItem`
    - `optionsSiteWhitelistRemoveItem`
    - `optionsSiteWhitelistInvalidMatchPattern`
    - `popupWhitelistNotWhitelisted`
    - `popupWhitelistAddToWhitelist`
    - `popupCastMenuTitle`
    - `popupStopMenuTitle`

- `nl`

    - `optionsBridgeBackupEnabled`
    - `optionsBridgeCompatible`
    - `optionsBridgeLikelyCompatible`
    - `optionsBridgeIncompatible`
    - `optionsOptionRecommended`
    - `optionsMirroringCategoryName`
    - `optionsMirroringCategoryDescription`
    - `optionsMirroringEnabled`
    - `optionsMirroringAppId`
    - `optionsSiteWhitelistCategoryName`
    - `optionsSiteWhitelistCategoryDescription`
    - `optionsSiteWhitelistEnabled`
    - `optionsSiteWhitelistEnabledDescription`
    - `optionsSiteWhitelistContent`
    - `optionsSiteWhitelistBasicView`
    - `optionsSiteWhitelistRawView`
    - `optionsSiteWhitelistSaveRaw`
    - `optionsSiteWhitelistAddItem`
    - `optionsSiteWhitelistUserAgent`
    - `optionsSiteWhitelistEditItem`
    - `optionsSiteWhitelistRemoveItem`
    - `optionsSiteWhitelistInvalidMatchPattern`
    - `popupWhitelistNotWhitelisted`
    - `popupWhitelistAddToWhitelist`
    - `popupMediaTypeAppNotFound`
    - `popupCastMenuTitle`
    - `popupStopMenuTitle`

- `no`
    - `optionsSiteWhitelistCategoryName`
    - `optionsSiteWhitelistCategoryDescription`
    - `optionsSiteWhitelistEnabled`
    - `optionsSiteWhitelistEnabledDescription`
    - `optionsSiteWhitelistContent`
    - `optionsSiteWhitelistBasicView`
    - `optionsSiteWhitelistRawView`
    - `optionsSiteWhitelistSaveRaw`
    - `optionsSiteWhitelistAddItem`
    - `optionsSiteWhitelistUserAgent`
    - `optionsSiteWhitelistEditItem`
    - `optionsSiteWhitelistRemoveItem`
    - `optionsSiteWhitelistInvalidMatchPattern`
    - `popupWhitelistNotWhitelisted`
    - `popupWhitelistAddToWhitelist`
    - `popupCastMenuTitle`
    - `popupStopMenuTitle`

- `it`
    - `popupMediaTypeFile`
    - `popupCastingButtonTitle`
    - `optionsBridgeOlderAction`
    - `optionsBridgeNewerAction`
    - `optionsBridgeUpdateCheck`
    - `optionsBridgeUpdateChecking`
    - `optionsBridgeBackupEnabled`
    - `optionsBridgeBackupEnabledDescription`
    - `optionsMediaCategoryName`
    - `optionsMediaCategoryDescription`
    - `optionsMediaCategoryDescription`
    - `optionsMediaEnabled`
    - `optionsMediaSyncElement`
    - `optionsMediaSyncElementDescription`
    - `optionsMediaStopOnUnload`
    - `optionsLocalMediaCategoryName`
    - `optionsLocalMediaCategoryDescription`
    - `optionsLocalMediaEnabled`
    - `optionsLocalMediaServerPort`
    - `optionsReceiverSelectorCategoryName`
    - `optionsReceiverSelectorCategoryDescription`
    - `optionsReceiverSelectorWaitForConnection`
    - `optionsReceiverSelectorWaitForConnectionDescription`
    - `optionsReceiverSelectorCloseIfFocusLost`
    - `optionsSiteWhitelistCategoryName`
    - `optionsSiteWhitelistCategoryDescription`
    - `optionsSiteWhitelistEnabled`
    - `optionsSiteWhitelistEnabledDescription`
    - `optionsSiteWhitelistContent`
    - `optionsSiteWhitelistBasicView`
    - `optionsSiteWhitelistRawView`
    - `optionsSiteWhitelistSaveRaw`
    - `optionsSiteWhitelistAddItem`
    - `optionsSiteWhitelistUserAgent`
    - `optionsSiteWhitelistEditItem`
    - `optionsSiteWhitelistRemoveItem`
    - `optionsSiteWhitelistInvalidDuplicatePattern`
    - `optionsSiteWhitelistKnownAppsCustomApp`
    - `optionsMirroringCategoryName`
    - `optionsMirroringCategoryDescription`
    - `optionsMirroringEnabled`
    - `optionsMirroringAppId`
    - `optionsMirroringAppIdDescription`
    - `optionsOptionRecommended`
    - `optionsReset`
    - `optionsSave`
    - `optionsSaved`

</details>

### NSIS Installer Localization

If you're comfortable editing and compiling NSIS installer scripts, use the following guide, otherwise just provide translated strings in an issue or PR comment.

To localize Windows installer strings, first add the relevant `MUI_LANGUAGE` macro to the end of the existing list (list of language names can be found [here](https://sourceforge.net/p/nsis/code/HEAD/tree/NSIS/trunk/Contrib/Language%20files/)):

```nsi
!insertmacro MUI_LANGUAGE "German"
```

Then, provide each version of the existing `LangString` commands with that language grouped under the existing strings:

```nsi
LangString MSG__EXAMPLE_STRING1 ${LANG_GERMAN} "Hallo"
LangString MSG__EXAMPLE_STRING2 ${LANG_GERMAN} "Welt"
```

Try to keep the line length under 80 characters by splitting lines within the string with a backslash at the end of the line and a double indent on the next line. To escape characters (like other double quotes), prepend with a `$\`.

Ensure the installer script file is saved as UTF-8 with BOM.
