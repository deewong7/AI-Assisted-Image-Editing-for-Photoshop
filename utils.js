const BASE_RESOLUTION = {
  "1K": 1024,
  "2K": 2048,
  "3K": 3072,
  "4K": 4096
};

function matchesModel(selectedModel, targetModelId) {
  if (!selectedModel || !targetModelId) {
    return false;
  }

  return Array.isArray(targetModelId)
    ? targetModelId.includes(selectedModel)
    : selectedModel === targetModelId;
}

function decodeBase64ToBinaryString(base64, atobImpl) {
  if (typeof atobImpl === "function") {
    return atobImpl(base64);
  }

  if (typeof Buffer !== "undefined") {
    return Buffer.from(base64, "base64").toString("binary");
  }

  throw new Error("No base64 decoder available in this environment.");
}

function normalizeBase64Payload(base64) {
  const trimmed = base64.trim();
  const match = /^data:[^,]*;base64,(.+)$/i.exec(trimmed);
  return match ? match[1] : trimmed;
}

function base64ToArrayBuffer(base64, atobImpl = typeof atob === "function" ? atob : undefined) {
  if (typeof base64 !== "string") {
    throw new TypeError("base64 must be a string");
  }

  const normalizedBase64 = normalizeBase64Payload(base64);
  const binaryString = decodeBase64ToBinaryString(normalizedBase64, atobImpl);
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
    seedream5ModelId,
    seedream5ProModelId,
    base = BASE_RESOLUTION
  } = options;

  const isSeedreamModel = matchesModel(selectedModel, seedreamModelId);
  const isSeedream5Model = matchesModel(selectedModel, seedream5ModelId);
  const isSeedream5ProModel = matchesModel(selectedModel, seedream5ProModelId);

  if (longEdge <= base["1K"] * upgradeFactor) {
    if (isSeedreamModel) {
      return "2K";
    }
    return "1K";
  }
  if (longEdge <= base["2K"] * upgradeFactor) {
    return "2K";
  }
  if (isSeedream5ProModel) {
    return "2K";
  }
  if (isSeedream5Model) {
    return "3K";
  }
  return "4K";
}

function getCurrentTime(date = new Date()) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `[${hours}:${minutes}:${seconds}]`;
}

function nonemptyApiKey(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : "";
}

function migrateGoogleApiKeys(apiKey) {
  if (!apiKey || typeof apiKey !== "object") {
    return apiKey;
  }

  const hasStudioKey = nonemptyApiKey(apiKey["GoogleAIStudio-api-key"]);
  const hasVertexKey = nonemptyApiKey(apiKey["GoogleVertexAI-api-key"]);
  if (hasStudioKey || hasVertexKey) {
    return apiKey;
  }

  const legacyKey = nonemptyApiKey(apiKey["NanoBananaPro-api-key"]);
  if (!legacyKey) {
    return apiKey;
  }

  if (legacyKey.startsWith("AIza")) {
    return { ...apiKey, "GoogleAIStudio-api-key": legacyKey };
  }

  return { ...apiKey, "GoogleVertexAI-api-key": legacyKey };
}

function loadKeysFromStorage(storage, defaultKeys) {
  const raw = storage.getItem("apiKeys");
  if (!raw) {
    return migrateGoogleApiKeys({ ...defaultKeys });
  }

  try {
    const parsed = JSON.parse(raw);
    return migrateGoogleApiKeys({ ...defaultKeys, ...parsed });
  } catch {
    return migrateGoogleApiKeys({ ...defaultKeys });
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

function loadPluginPrefsFromStorage(storage, defaultPrefs) {
  const raw = storage.getItem("pluginPrefs");
  if (!raw) {
    return { ...defaultPrefs };
  }

  try {
    const parsed = JSON.parse(raw);
    return { ...defaultPrefs, ...parsed };
  } catch {
    return { ...defaultPrefs };
  }
}

function savePluginPrefsToStorage(storage, prefs) {
  storage.setItem("pluginPrefs", JSON.stringify(prefs));
}

module.exports = {
  BASE_RESOLUTION,
  base64ToArrayBuffer,
  pickTier,
  getCurrentTime,
  migrateGoogleApiKeys,
  loadKeysFromStorage,
  saveKeysToStorage,
  loadPromptPresetsFromStorage,
  savePromptPresetsToStorage,
  loadPluginPrefsFromStorage,
  savePluginPrefsToStorage
};
