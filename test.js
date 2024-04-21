import { createServer } from "./http-server.js";
const __dirname = import.meta.dirname;
const server = createServer({ pubdir: __dirname, port: 1234, showServingMessage: true });
