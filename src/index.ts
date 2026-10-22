import * as app from "./launcher";
if (typeof globalThis === "object") {
    Object.defineProperty(globalThis, "JSCPP", {
        value: app.default,
        enumerable: false,
        configurable: false,
        writable: false,
    })
} else if (typeof window === "object") {
    /* Legacy browsers support (pre-ES6) */
    Object.defineProperty(window, "JSCPP", {
        value: app.default,
        enumerable: false,
        configurable: false,
        writable: false,
    })
} else {
    throw new Error("Could not locate the global object");
}
