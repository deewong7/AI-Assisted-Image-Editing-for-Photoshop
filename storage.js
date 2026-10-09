const utils = require("./utils");

function loadApiKeys(storage, defaults) {
  return utils.loadApiKeyStore(storage, defaults);
}

function saveApiKeys(storage, apiKeyStore) {
  utils.saveApiKeyStore(storage, apiKeyStore);
}

function loadPromptPresets(storage, defaults) {
  return utils.loadPromptPresetsFromStorage(storage, defaults);
}

function savePromptPresets(storage, presets) {
  utils.savePromptPresetsToStorage(storage, presets);
}

function loadPluginPrefs(storage, defaults) {
  return utils.loadPluginPrefsFromStorage(storage, defaults);
}

function savePluginPrefs(storage, prefs) {
  utils.savePluginPrefsToStorage(storage, prefs);
}

module.exports = {
  loadApiKeys,
  saveApiKeys,
  loadPromptPresets,
  savePromptPresets,
  loadPluginPrefs,
  savePluginPrefs
};
