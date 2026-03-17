import { createRequire } from "module";
const require = createRequire(import.meta.url);
const controlCenterService = require("./main.js");

export default controlCenterService;
