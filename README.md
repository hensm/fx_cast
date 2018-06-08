# Caster

Very WIP! Not ready for release. Expect many bugs. Please don't sign builds on AMO with current ID.

## Supported platforms

* Linux
* macOS (TODO)
* Windows (TODO)

Only tested on Linux. mDNS library issue to be fixed. `mdns` only works on Windows, `mdns-js` only works on Linux.


## Building

### Requirements

* NodeJS
* `node` binary in path
* ~~Bonjour SDK (Windows)~~

````
git clone https://github.com/hensm/caster.git
npm install ./ext --prefix ./ext
npm install ./app --prefix ./app
npm run build --prefix ./ext
````

Installer scripts aren't written yet, so registering the native messaging manifest with Firefox and specifiying the path must be done manually:  
[MDN: Native Manifests](https://developer.mozilla.org/en-US/Add-ons/WebExtensions/Native_manifests)

`path` key within `app/caster_bridge.json` must be set to absolute path of `app/src/launcher.sh` or `app/src/launcher.bat`. Then, the manifest must be either moved to the correct location or the path added to the registry (Windows):  
[MDN: Native Manifests # Manifest location](https://developer.mozilla.org/en-US/Add-ons/WebExtensions/Native_manifests#Manifest_location)

Extension can be loaded from `about:debugging` as a temporary extension.

