<img src="docs/images/preview-fg_macOS_dark@2x.png"
     alt="Preview of cast device selection popup"
     align="right"
     width="462">

# fx_cast

Firefox extension that implements the [Chrome sender API](https://developers.google.com/cast/docs/reference/chrome/) and exposes it to web apps to enable cast support. Communication with receiver devices is handled by a native application (bridge). Check the [implementation notes](IMPLEMENTATION.md) for more info.

_**Note**: No full public release yet! Pre-release beta version is incomplete and likely buggy._


## Installing

_**Note**: Currently supported on macOS, Windows and Linux._

Install the Firefox extension (from within Firefox) and companion bridge application via the installer packages. These are two separate downloads that can be found on the [website](https://hensm.github.io/fx_cast/) or in the [GitHub releases](https://github.com/hensm/fx_cast/releases) section.

### Package managers
* #### Arch Linux (AUR) - https://aur.archlinux.org/packages/fx_cast/
  ````sh
  yay -S fx_cast
  ````


## Usage

Most websites won't load the cast API unless the browser presents itself as Chrome. The extension includes a whitelist for sites that should be given a Chrome-compatible user agent string. Whitelist entries are specified as [match patterns](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Match_patterns). To whitelist all sites, add `<all_urls>` to the whitelist, though this is not recommended and could cause breakage on random sites.

Whitelisted sites should then display a cast button as in Chrome, provided they're compatible with the extension/Firefox.

The `Cast...` menu item is visible in the page, toolbar button and tools menus, and provides access to the receiver selector at any time to stop an existing session or start screen mirroring or file casting.

HTML5 media elements also have a different `Cast...` context menu item that triggers the media sender, though this won't work for media using EME/MSE.


## Building

### Requirements

* Node.js <= 13.x

### Instructions

````sh
git clone https://github.com/hensm/fx_cast.git
cd fx_cast
npm install
npm run build
npm run install-manifest
````

This will build the ext and app, outputting to `dist/`:

* #### `dist/app/`  
   ... contains the bridge executable and manifest with the path pointing that executable. The `install-manifest` script copies this manifest to the proper location (or adds its current location to the registry on Windows).
* #### `dist/ext/`  
    ... contains the unpacked extension.

Watching ext changes:

````sh
npm run watch --prefix ./ext
````

Launch Firefox watch for file changes (run in separate terminal):

````sh
npm run start --prefix ./ext
````

#### Extension build script arguments

* `--package`  
    Should package with web-ext.
* `--watch`  
    Should run webpack in watch mode.
* `--packageType` `"<appID>"`  
    Provide an alternative default mirroring receiver app ID.
* `--mode` `"production"`, `"development"`  
    Run webpack in a different mode. Defaults to `"development"` unless combined with `--package`.

### Packaging

#### Requirements
* `dpkg-deb` (if building .deb packages)
* `rpmbuild` (if building .rpm packages)
* `makensis` (if building Windows installer packages)
* macOS (if building macOS installer packages)
    * Xcode (optional if not building native receiver selector)

_**Note**: macOS packages can only be build on macOS._

#### Installing dependencies

##### macOS:
````sh
brew install dpkg rpm makensis
````

##### Debian / Ubuntu:
````sh
sudo apt install dpkg rpm nsis
````

##### Fedora:
````sh
sudo dnf install dpkg rpm-build mingw-nsis
````

##### Arch Linux:
```sh
sudo pacman -S dpkg
yay -S rpm-org nsis
```

Build and package extension and bridge application for current platform:

````sh
npm run package
````

* #### `dist/app/`  
    ... contains the installer package: `fx_cast_bridge-<version>-<arch>.(pkg|deb|rpm|exe)`
* #### `dist/ext/`  
    ... contains the built extension archive: `fx_cast-<version>.xpi`.

Packaging examples:

````sh
npm run package:ext # Packaging extension
npm run package:app # Packaging bridge application

# Linux platforms
npm run package:app -- -- --platform=linux --packageType=deb
npm run package:app -- -- --platform=linux --packageType=rpm

# Windows
npm run package:app -- -- --platform=win32

# macOS
npm run package:app -- -- --platform=darwin
````

#### Bridge package script arguments

* `--platform` `"win32"`,`"darwin"`,`"linux"`  
    Select the platform to build for. Defaults to current platform.
* `--arch` `"x64"`,`"x86"`  
    Select platform arch to build for. Defaults to current platform arch.
* `--packageType` `"deb"`,`"rpm"`  
    Select the package type. Defaults to `deb`. Only relevant when building for Linux.
* `--skipNativeBuilds`  
    macOS only. Skips native receiver selector build.


### Testing

Testing requires geckodriver (or chromedriver for Chrome parity testing). See [selenium-webdriver](https://www.npmjs.com/package/selenium-webdriver#installation) installation instructions (ignore `npm install`).

The test script expects a compatible installed bridge version and an extension archive at `dist/ext/`.

Test results will be displayed in the terminal and within the opened browser tab. Chrome may take some time to initialize the media router component before the cast API is available for testing.

````sh
npm run build --prefix ./app
npm run install-manifest
npm run package --prefix ./ext
npm test
SELENIUM_BROWSER=chrome npm test
````


## Video Demos

Netflix / HTML5:

[<img width="200" src="https://img.youtube.com/vi/Ex9dWKYguEE/0.jpg" alt="fx_cast Netflix" />](https://www.youtube.com/watch?v=Ex9dWKYguEE)
[<img width="200" src="https://img.youtube.com/vi/16r8lQKeEX8/0.jpg" alt="fx_cast HTML5" />](https://www.youtube.com/watch?v=16r8lQKeEX8)


## Credit

_**Note**: Since it seems to be causing confusion, this project does not use electron. The electron-chromecast library was only used as a reference for the initial implementation of the API shim._

* [electron-chromecast](https://github.com/GPMDP/electron-chromecast)
* [node-castv2](https://github.com/thibauts/node-castv2)
* [icons8](https://icons8.com/)


## Donation

### PayPal

To donate via PayPal:

[<img src="https://www.paypal.com/en_US/i/btn/btn_donateCC_LG.gif" alt="Donate with PayPal button">](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=3Z2FTMSG976WN&source=url)

<img alt="Donate with PayPal" src="https://i.imgur.com/oisL6Eo.png">
