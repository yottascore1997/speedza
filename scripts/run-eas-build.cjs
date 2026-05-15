/**
 * Runs EAS CLI with os.availableParallelism polyfill on current + child Node processes
 * (fixes "os.availableParallelism is not a function" on Node < 18.14).
 */
"use strict";

const path = require("path");
const { spawnSync } = require("child_process");

const root = path.join(__dirname, "..");
const poly = path.join(__dirname, "node-os-polyfill.cjs");
require(poly);

const flag = `--require=${poly}`;
const prev = process.env.NODE_OPTIONS || "";
process.env.NODE_OPTIONS = prev.includes("node-os-polyfill") ? prev : prev ? `${prev} ${flag}` : flag;

const easBin = path.join(root, "node_modules", "eas-cli", "bin", "run");
const profile = process.argv[2] || "production";
const platform = process.argv[3] || "android";

const r = spawnSync(process.execPath, [easBin, "build", "--platform", platform, "--profile", profile], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});

process.exit(r.status === null ? 1 : r.status);
