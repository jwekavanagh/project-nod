// Node 18+ provides globalThis.DOMException. fetch-blob imports this for legacy environments.
const DOMException = globalThis.DOMException;
if (typeof DOMException === "undefined") {
  throw new Error("node-domexception-native requires a Node.js with globalThis.DOMException (Node 18+).");
}
export default DOMException;
