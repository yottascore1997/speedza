/**
 * Older Node (< 18.14) has no `os.availableParallelism()`. Some Expo / EAS / Metro
 * deps call it — load with: node -r ./scripts/node-os-polyfill.cjs ...
 * Prefer upgrading to Node 20 LTS instead of relying on this.
 */
"use strict";

const os = require("os");
if (typeof os.availableParallelism !== "function") {
  const impl = function availableParallelism() {
    return Math.max(1, typeof os.cpus === "function" ? os.cpus().length : 4);
  };
  try {
    Object.defineProperty(os, "availableParallelism", {
      value: impl,
      configurable: true,
      enumerable: true,
      writable: true,
    });
  } catch {
    os.availableParallelism = impl;
  }
}
