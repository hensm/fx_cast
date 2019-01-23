# fx_cast

Very WIP! Not ready for release. Expect many bugs. Please don't sign builds on AMO with current ID.

Credit:

* [electron-chromecast](https://github.com/GPMDP/electron-chromecast)
* [node-castv2](https://github.com/thibauts/node-castv2)
* [chrome-native-messaging](https://github.com/jdiamond/chrome-native-messaging)
* [icons8](https://icons8.com/)


## Supported platforms

* Linux
* macOS
* Windows

## Installing

macOS:

1. Download the .pkg file
2. Install it
3. Install the [firefox extension](https://github.com/hensm/fx_cast/releases/download/v0.0.1/fx_cast-0.0.1-fx.xpi)


Debian/Ubuntu:

1. Download the .deb file
2. `$ sudo dpkg -i fx_cast.deb`
3. Install the [firefox extension](https://github.com/hensm/fx_cast/releases/download/v0.0.1/fx_cast-0.0.1-fx.xpi)

Fedora:

1. Download the .rpm file
2. `$ sudo dnf install fx_cast.rpm`
3. Install the [firefox extension](https://github.com/hensm/fx_cast/releases/download/v0.0.1/fx_cast-0.0.1-fx.xpi)


ArchLinux (AUR):

1. `$ yay -S fx_cast`
2. Install the [firefox extension](https://github.com/hensm/fx_cast/releases/download/v0.0.1/fx_cast-0.0.1-fx.xpi)


## Building

### Requirements

* NodeJS
* dpkg (for building deb packages)
* rpm (for building rpm packages)
* macOS (for building macOS installer packages)

#### Installing dependencies
macOS:

````sh
brew install dpkg rpm
````

Debian/Ubuntu:

````sh
sudo apt install dpkg rpm
````

Fedora:

````sh
sudo dnf install dpkg rpm-build
````

Archlinux:

At the moment, `pkg` has a [bug](https://github.com/zeit/pkg/issues/584), until fixed nodejs has to be downgraded to `10.12.0`:

```sh
sudo pacman -S nvm
echo 'source /usr/share/nvm/init-nvm.sh' >> ~/.bashrc
nvm install 10.12.0
```

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
   ... contains the bridge binary and manifest with the path pointing that binary. `install-manifest` copies this manifest to the proper location (or adds its current location to the registry).
* #### `dist/ext/`  
    ... contains the unpacked extension.

Watching ext changes:

````sh
npm run watch --prefix ./ext
````

Launch Firefox and auto-reload on rebuild (run in separate terminal):

````sh
npm run start --prefix ./ext
````

### Packaging

Packaging currently only possible for macOS/Linux. macOS packages can only be created on macOS, Linux .deb/.rpm packages can be built on any platform with `dpkg-deb` and `rpmbuild` binaries.

* #### `dist/app/`  
    ... contains the installer package: `fx_cast_bridge.(pkg|deb|rpm|exe)`
* #### `dist/ext/`  
    ... contains the built extension in the format `fx_cast-<version>.zip`.

Build and package app and extension for current platform:

````sh
npm run package
````

Build and package app for linux platforms:

````sh
npm run package --prefix ./app -- --platform=linux --packageType=deb
npm run package --prefix ./app -- --platform=linux --packageType=rpm
````

##### Package script arguments

* `--platform` `"win"`,`"mac"`,`"linux"`  
    Select the platform to build for.
* `--packageType` `"deb"`,`"rpm"`  
    Select the package type. Defaults to `deb`. Only relevant when building for Linux.

### Testing

Testing requires geckodriver (or chromedriver for Chrome parity testing). See [selenium-webdriver](https://www.npmjs.com/package/selenium-webdriver#installation) installation instructions (ignore `npm install`).

Test results will be displayed within the opened browser tab.

````sh
npm run build --prefix ./app
npm run install-manifest
npm run package --prefix ./ext
npm test
SELENIUM_BROWSER=chrome npm test
````


## Usage

Extension can be loaded from `about:debugging` as a temporary extension.

Most sites won't load the cast API unless the browser presents itself as Chrome. The extension includes a method of spoofing the user agent string, sites can be whitelisted via the options page. Whitelist entries are specified as [match patterns](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Match_patterns). To whitelist all sites, add `<all_urls>` to the whitelist, though this could cause breakage on random sites.

HTML5 media elements have a "Cast..." context menu item that triggers a sender application. Only works on remote (non-local) media that isn't DRM-encumbered.

Cast-enabled websites will load the sender API shim and display a cast button as in Chrome, provided there are no bugs/incompatibilities with the shim.


## Video Demos

Netflix / HTML5:

[<img width="200" src="https://img.youtube.com/vi/Ex9dWKYguEE/0.jpg" alt="fx_cast Netflix" />](https://www.youtube.com/watch?v=Ex9dWKYguEE)
[<img width="200" src="https://img.youtube.com/vi/16r8lQKeEX8/0.jpg" alt="fx_cast HTML5" />](https://www.youtube.com/watch?v=16r8lQKeEX8)
