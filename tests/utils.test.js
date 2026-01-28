const test = require("node:test");
const assert = require("node:assert/strict");
const utils = require("../utils");

function createStorage(initial = {}) {
  const store = { ...initial };
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    setItem(key, value) {
      store[key] = value;
    },
    _store: store
  };
}

test.describe("base64ToArrayBuffer", () => {
  test("decodes base64", () => {
    const base64 = "aGVsbG8="; // "hello"
    const buffer = utils.base64ToArrayBuffer(base64);
    const bytes = Array.from(new Uint8Array(buffer));
    assert.deepEqual(bytes, [104, 101, 108, 108, 111]);
  });
});

test.describe("pickTier", () => {
  test("picks 2K for seedream under 1K threshold", () => {
    const tier = utils.pickTier(800, {
      upgradeFactor: 1.5,
      selectedModel: "seedream",
      seedreamModelId: "seedream"
    });
    assert.equal(tier, "2K");
  });

  test("picks 1K for non-seedream under 1K threshold", () => {
    const tier = utils.pickTier(800, {
      upgradeFactor: 1.5,
      selectedModel: "other",
      seedreamModelId: "seedream"
    });
    assert.equal(tier, "1K");
  });
});

test.describe("getCurrentTime", () => {
  test("formats time", () => {
    const date = new Date(2023, 0, 2, 3, 4, 5);
    const value = utils.getCurrentTime(date);
    assert.equal(value, "[03:04:05]");
  });
});

test.describe("loadKeysFromStorage", () => {
  test("returns defaults when missing", () => {
    const storage = createStorage();
    const defaults = { keyA: "", keyB: "" };
    assert.deepEqual(utils.loadKeysFromStorage(storage, defaults), defaults);
  });

  test("merges stored values", () => {
    const storage = createStorage({
      apiKeys: JSON.stringify({ keyB: "value" })
    });
    const defaults = { keyA: "", keyB: "" };
    assert.deepEqual(utils.loadKeysFromStorage(storage, defaults), {
      keyA: "",
      keyB: "value"
    });
  });
});

test.describe("loadPromptPresetsFromStorage", () => {
  test("persists defaults on missing", () => {
    const storage = createStorage();
    const defaults = { preset: "value" };
    const loaded = utils.loadPromptPresetsFromStorage(storage, defaults);
    assert.deepEqual(loaded, defaults);
    assert.equal(storage._store.promptPresets, JSON.stringify(defaults));
  });

  test("replaces invalid JSON", () => {
    const storage = createStorage({
      promptPresets: "{invalid"
    });
    const defaults = { preset: "value" };
    const loaded = utils.loadPromptPresetsFromStorage(storage, defaults);
    assert.deepEqual(loaded, defaults);
    assert.equal(storage._store.promptPresets, JSON.stringify(defaults));
  });
});
