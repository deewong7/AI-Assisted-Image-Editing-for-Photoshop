const { beforeEach, afterEach } = require("node:test");

const original = {
  log: console.log,
  info: console.info,
  debug: console.debug,
  warn: console.warn,
  error: console.error
};

beforeEach(() => {
  if (process.env.SHOW_LOGS === "1") return;
  console.log = () => {};
  console.info = () => {};
  console.debug = () => {};
  console.warn = () => {};
  console.error = () => {};
});

afterEach(() => {
  console.log = original.log;
  console.info = original.info;
  console.debug = original.debug;
  console.warn = original.warn;
  console.error = original.error;
});
