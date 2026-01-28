const { spawnSync } = require("node:child_process");

const nodeMajor = Number.parseInt(process.versions.node.split(".")[0], 10);
const args = ["--test", "--test-concurrency=1"];

if (Number.isFinite(nodeMajor) && nodeMajor >= 22) {
  args.push("--test-isolation=none");
}

const result = spawnSync(process.execPath, args, {
  stdio: "inherit",
  env: process.env
});

process.exit(result.status ?? 1);
