const PROMPT_LIBRARY_VERSION = 1;

function isObjectRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizePromptPresets(presetsInput) {
  if (!isObjectRecord(presetsInput)) {
    return {};
  }

  const normalized = {};
  Object.keys(presetsInput).forEach(rawKey => {
    const key = String(rawKey || "").trim();
    const value = presetsInput[rawKey];
    if (!key || typeof value !== "string" || value.trim().length === 0) {
      return;
    }
    normalized[key] = value;
  });
  return normalized;
}

function serializePromptLibrary(presets) {
  const payload = {
    version: PROMPT_LIBRARY_VERSION,
    presets: normalizePromptPresets(presets)
  };
  return JSON.stringify(payload, null, 2);
}

function extractSourcePresets(parsed) {
  if (!isObjectRecord(parsed)) {
    throw new Error("Invalid prompt library JSON format.");
  }

  if (Object.prototype.hasOwnProperty.call(parsed, "version")) {
    const parsedVersion = Number(parsed.version);
    if (!Number.isFinite(parsedVersion)) {
      throw new Error("Invalid prompt library version.");
    }
    if (parsedVersion !== PROMPT_LIBRARY_VERSION) {
      throw new Error("Unsupported prompt library version: " + parsed.version);
    }
    if (!isObjectRecord(parsed.presets)) {
      throw new Error("Invalid prompt library presets payload.");
    }
    return {
      version: parsedVersion,
      sourcePresets: parsed.presets
    };
  }

  if (isObjectRecord(parsed.presets)) {
    return {
      version: null,
      sourcePresets: parsed.presets
    };
  }

  return {
    version: null,
    sourcePresets: parsed
  };
}

function parsePromptLibraryJson(jsonText) {
  if (typeof jsonText !== "string" || jsonText.trim().length === 0) {
    throw new Error("Prompt library file is empty.");
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("Invalid JSON file.");
  }

  const { version, sourcePresets } = extractSourcePresets(parsed);
  const presets = normalizePromptPresets(sourcePresets);
  if (Object.keys(presets).length === 0) {
    throw new Error("No valid prompt presets found in file.");
  }

  return {
    version,
    presets
  };
}

module.exports = {
  PROMPT_LIBRARY_VERSION,
  normalizePromptPresets,
  serializePromptLibrary,
  parsePromptLibraryJson
};
