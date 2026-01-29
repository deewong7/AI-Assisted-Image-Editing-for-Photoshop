const utils = require("./utils");

function loadApiKeys(storage, defaults) {
  return utils.loadKeysFromStorage(storage, defaults);
}

function saveApiKeys(storage, apiKey) {
  utils.saveKeysToStorage(storage, apiKey);
}

function loadPromptPresets(storage, defaults) {
  return utils.loadPromptPresetsFromStorage(storage, defaults);
}

function savePromptPresets(storage, presets) {
  utils.savePromptPresetsToStorage(storage, presets);
}

module.exports = {
  loadApiKeys,
  saveApiKeys,
  loadPromptPresets,
  savePromptPresets
};
