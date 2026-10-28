// Lets node load the app's modules, which import each other with absolute paths ("/js/core/config.js") as the browser does: they are
// read from src/. Used as `node --import ./test/support/register.mjs --test ...` (npm test).
import { register } from "node:module";
register("./resolve_hook.mjs", import.meta.url);
