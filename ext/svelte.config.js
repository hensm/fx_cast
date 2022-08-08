// svelte-vscode seems to require a config for proper linting support
const sveltePreprocess = require("svelte-preprocess");
module.exports = {
    preprocess: sveltePreprocess()
};
