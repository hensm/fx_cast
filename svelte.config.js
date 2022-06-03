// svelte-vscode seems to require a config for proper linting support
const sveltePreprocess = require("./ext/node_modules/svelte-preprocess");
module.exports = {
    preprocess: sveltePreprocess()
};
