const BASE_RESOLUTION = {
  "1K": 1024,
  "2K": 2048,
  "4K": 4096
};

function decodeBase64ToBinaryString(base64, atobImpl) {
  if (typeof atobImpl === "function") {
    return atobImpl(base64);
  }

  if (typeof Buffer !== "undefined") {
    return Buffer.from(base64, "base64").toString("binary");
  }

  throw new Error("No base64 decoder available in this environment.");
}

function base64ToArrayBuffer(base64, atobImpl = typeof atob === "function" ? atob : undefined) {
  if (typeof base64 !== "string") {
    throw new TypeError("base64 must be a string");
  }

  const binaryString = decodeBase64ToBinaryString(base64, atobImpl);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function pickTier(longEdge, options = {}) {
  const {
    upgradeFactor = 1.5,
    selectedModel,
    seedreamModelId,
    base = BASE_RESOLUTION
  } = options;

  if (longEdge <= base["1K"] * upgradeFactor) {
    if (
      selectedModel &&
      seedreamModelId &&
      (Array.isArray(seedreamModelId)
        ? seedreamModelId.includes(selectedModel)
        : selectedModel === seedreamModelId)
    ) {
      return "2K";
    }
    return "1K";
  }
  if (longEdge <= base["2K"] * upgradeFactor) {
    return "2K";
  }
  return "4K";
}

function getCurrentTime(date = new Date()) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `[${hours}:${minutes}:${seconds}]`;
}

function loadKeysFromStorage(storage, defaultKeys) {
  const raw = storage.getItem("apiKeys");
  if (!raw) {
    return { ...defaultKeys };
  }

  try {
    const parsed = JSON.parse(raw);
    return { ...defaultKeys, ...parsed };
  } catch {
    return { ...defaultKeys };
  }
}

function saveKeysToStorage(storage, apiKey) {
  storage.setItem("apiKeys", JSON.stringify(apiKey));
}

function loadPromptPresetsFromStorage(storage, defaultPresets) {
  const raw = storage.getItem("promptPresets");
  if (!raw) {
    storage.setItem("promptPresets", JSON.stringify(defaultPresets));
    return defaultPresets;
  }

  try {
    return JSON.parse(raw);
  } catch {
    storage.setItem("promptPresets", JSON.stringify(defaultPresets));
    return defaultPresets;
  }
}

function savePromptPresetsToStorage(storage, presets) {
  storage.setItem("promptPresets", JSON.stringify(presets));
}

module.exports = {
  BASE_RESOLUTION,
  base64ToArrayBuffer,
  pickTier,
  getCurrentTime,
  loadKeysFromStorage,
  saveKeysToStorage,
  loadPromptPresetsFromStorage,
  savePromptPresetsToStorage
};
