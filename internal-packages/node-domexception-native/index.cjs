"use strict";
// Node 18+ provides globalThis.DOMException.
const DOMException = globalThis.DOMException;
if (typeof DOMException === "undefined") {
  throw new Error("node-domexception-native requires a Node.js with globalThis.DOMException (Node 18+).");
}
module.exports = DOMException;
module.exports.default = DOMException;
