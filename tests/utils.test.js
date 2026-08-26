const test = require("node:test");
const assert = require("node:assert/strict");
const utils = require("../utils.js");

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

  test("decodes base64 payload with data URL prefix", () => {
    const base64 = "data:image/png;base64,aGVsbG8="; // "hello"
    const buffer = utils.base64ToArrayBuffer(base64);
    const bytes = Array.from(new Uint8Array(buffer));
    assert.deepEqual(bytes, [104, 101, 108, 108, 111]);
  });

  test("passes pure base64 through unchanged", () => {
    let received;
    utils.base64ToArrayBuffer("aGVsbG8=", (value) => {
      received = value;
      return "hello";
    });
    assert.equal(received, "aGVsbG8=");
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

  test("picks 2K for seedream list under 1K threshold", () => {
    const tier = utils.pickTier(800, {
      upgradeFactor: 1.5,
      selectedModel: "seedream-5",
      seedreamModelId: ["seedream-4", "seedream-5"]
    });
    assert.equal(tier, "2K");
  });

  test("picks 3K for seedream 5 above 2K threshold", () => {
    const tier = utils.pickTier(4000, {
      upgradeFactor: 1.5,
      selectedModel: "seedream-5",
      seedreamModelId: ["seedream-4", "seedream-5"],
      seedream5ModelId: "seedream-5"
    });
    assert.equal(tier, "3K");
  });

  test("keeps 4K for seedream 4.5 above 2K threshold", () => {
    const tier = utils.pickTier(4000, {
      upgradeFactor: 1.5,
      selectedModel: "seedream-4",
      seedreamModelId: ["seedream-4", "seedream-5"],
      seedream5ModelId: "seedream-5",
      allow4KGeneration: true
    });
    assert.equal(tier, "4K");
  });

  test("caps seedream 4.5 at 2K when 4K is not allowed", () => {
    const tier = utils.pickTier(4000, {
      upgradeFactor: 1.5,
      selectedModel: "seedream-4",
      seedreamModelId: ["seedream-4", "seedream-5"],
      seedream5ModelId: "seedream-5",
      allow4KGeneration: false
    });
    assert.equal(tier, "2K");
  });

  test("picks 1K for seedream 5 pro under 1K threshold", () => {
    const tier = utils.pickTier(800, {
      upgradeFactor: 1.5,
      selectedModel: "seedream-5-pro",
      seedreamModelId: ["seedream-4", "seedream-5"],
      seedream5ModelId: "seedream-5",
      seedream5ProModelId: "seedream-5-pro"
    });
    assert.equal(tier, "1K");
  });

  test("caps seedream 5 pro at 2K above 2K threshold", () => {
    const tier = utils.pickTier(4000, {
      upgradeFactor: 1.5,
      selectedModel: "seedream-5-pro",
      seedreamModelId: ["seedream-4", "seedream-5"],
      seedream5ModelId: "seedream-5",
      seedream5ProModelId: "seedream-5-pro"
    });
    assert.equal(tier, "2K");
  });
});

test.describe("capResolution", () => {
  test("caps Nano Banana Pro 4K to 2K when 4K is not allowed", () => {
    assert.equal(utils.capResolution("4K", "gemini-3-pro-image", {
      allow4KGeneration: false
    }), "2K");
  });

  test("keeps Nano Banana Pro 4K when 4K is allowed", () => {
    assert.equal(utils.capResolution("4K", "gemini-3-pro-image", {
      allow4KGeneration: true
    }), "4K");
  });

  test("keeps SeeDream 5.0 3K when 4K is not allowed", () => {
    assert.equal(utils.capResolution("3K", "seedream-5", {
      allow4KGeneration: false,
      seedream5ModelId: "seedream-5"
    }), "3K");
  });
});

test.describe("getCurrentTime", () => {
  test("formats time", () => {
    const date = new Date(2023, 0, 2, 3, 4, 5);
    const value = utils.getCurrentTime(date);
    assert.equal(value, "[03:04:05]");
  });
});

test.describe("migrateGoogleApiKeys", () => {
  test("copies a legacy AIza key into the Studio slot", () => {
    const migrated = utils.migrateGoogleApiKeys({
      "NanoBananaPro-api-key": "AIza_LEGACY"
    });
    assert.equal(migrated["GoogleAIStudio-api-key"], "AIza_LEGACY");
    assert.equal(migrated["GoogleVertexAI-api-key"], undefined);
  });

  test("copies a legacy non-AIza key into the Vertex slot", () => {
    const migrated = utils.migrateGoogleApiKeys({
      "NanoBananaPro-api-key": "AQ_LEGACY"
    });
    assert.equal(migrated["GoogleVertexAI-api-key"], "AQ_LEGACY");
    assert.equal(migrated["GoogleAIStudio-api-key"], undefined);
  });

  test("does not overwrite already split Google keys", () => {
    const migrated = utils.migrateGoogleApiKeys({
      "NanoBananaPro-api-key": "AQ_LEGACY",
      "GoogleAIStudio-api-key": "STUDIO_KEY"
    });
    assert.equal(migrated["GoogleAIStudio-api-key"], "STUDIO_KEY");
    assert.equal(migrated["GoogleVertexAI-api-key"], undefined);
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

  test("migrates a stored legacy Google key on load", () => {
    const storage = createStorage({
      apiKeys: JSON.stringify({ "NanoBananaPro-api-key": "AIza_LEGACY" })
    });
    const loaded = utils.loadKeysFromStorage(storage, {
      "NanoBananaPro-api-key": "",
      "GoogleAIStudio-api-key": "",
      "GoogleVertexAI-api-key": ""
    });
    assert.equal(loaded["GoogleAIStudio-api-key"], "AIza_LEGACY");
    assert.equal(loaded["NanoBananaPro-api-key"], "AIza_LEGACY");
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

test.describe("loadPluginPrefsFromStorage", () => {
  test("returns defaults when missing", () => {
    const storage = createStorage();
    const defaults = {
      persistGeneratedImages: false,
      enableBatchGeneration: false,
      showChatTab: true,
      googleApiBackend: "google-ai-studio",
      maxWaitingTimeSeconds: 120,
      maxBatchCount: 8,
      enableGeneratedGroupColorLabel: false,
      generatedGroupColorLabel: "blue"
    };
    assert.deepEqual(utils.loadPluginPrefsFromStorage(storage, defaults), defaults);
  });

  test("merges stored plugin preferences", () => {
    const storage = createStorage({
      pluginPrefs: JSON.stringify({ persistGeneratedImages: true })
    });
    const defaults = {
      persistGeneratedImages: false,
      enableBatchGeneration: false,
      showChatTab: true,
      googleApiBackend: "google-ai-studio",
      maxWaitingTimeSeconds: 120,
      maxBatchCount: 8,
      enableGeneratedGroupColorLabel: false,
      generatedGroupColorLabel: "blue"
    };
    assert.deepEqual(utils.loadPluginPrefsFromStorage(storage, defaults), {
      persistGeneratedImages: true,
      enableBatchGeneration: false,
      showChatTab: true,
      googleApiBackend: "google-ai-studio",
      maxWaitingTimeSeconds: 120,
      maxBatchCount: 8,
      enableGeneratedGroupColorLabel: false,
      generatedGroupColorLabel: "blue"
    });
  });

  test("falls back to defaults on invalid JSON", () => {
    const storage = createStorage({
      pluginPrefs: "{invalid"
    });
    const defaults = {
      persistGeneratedImages: false,
      enableBatchGeneration: false,
      showChatTab: true,
      googleApiBackend: "google-ai-studio",
      maxWaitingTimeSeconds: 120,
      maxBatchCount: 8,
      enableGeneratedGroupColorLabel: false,
      generatedGroupColorLabel: "blue"
    };
    assert.deepEqual(utils.loadPluginPrefsFromStorage(storage, defaults), defaults);
  });
});

test.describe("savePluginPrefsToStorage", () => {
  test("stores plugin preferences under pluginPrefs key", () => {
    const storage = createStorage();
    utils.savePluginPrefsToStorage(storage, {
      persistGeneratedImages: true,
      enableBatchGeneration: false,
      showChatTab: false,
      googleApiBackend: "vertex-ai",
      maxWaitingTimeSeconds: 90,
      maxBatchCount: 12,
      enableGeneratedGroupColorLabel: true,
      generatedGroupColorLabel: "orange"
    });
    assert.equal(storage._store.pluginPrefs, JSON.stringify({
      persistGeneratedImages: true,
      enableBatchGeneration: false,
      showChatTab: false,
      googleApiBackend: "vertex-ai",
      maxWaitingTimeSeconds: 90,
      maxBatchCount: 12,
      enableGeneratedGroupColorLabel: true,
      generatedGroupColorLabel: "orange"
    }));
  });
});
