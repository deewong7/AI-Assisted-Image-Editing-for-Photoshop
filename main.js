const { entrypoints } = require("uxp");
const shell = require("uxp").shell;
const { app, core, constants } = require("photoshop");
const imaging = require("photoshop").imaging;
const fs = require("uxp").storage.localFileSystem;

const utils = require("./utils");
const { generateWithProvider, critiqueWithProvider } = require("./providers/index.js");
const { createSelection } = require("./photoshop/selection");
const { createPlacer } = require("./photoshop/place");
const { createLogger } = require("./log");
const storage = require("./storage");
const { getUI } = require("./ui");
const {
  SEEDREAM,
  SEEDREAM_5,
  NANOBANANA_PRO,
  GROK_IMAGINE,
  DEFAULT_API_KEYS,
  DEFAULT_PLUGIN_PREFS,
  DEFAULT_PROMPT_PRESETS,
  DEFAULT_CHAT_PROMPT,
  createState
} = require("./state");
const { createGenerator } = require("./generation");
const { initializeUI, bindEvents } = require("./events");

const ui = getUI();
if (ui.modelPicker) {
  ui.modelPicker.value = NANOBANANA_PRO;
}

const apiKey = storage.loadApiKeys(localStorage, DEFAULT_API_KEYS);
const promptPresets = storage.loadPromptPresets(localStorage, DEFAULT_PROMPT_PRESETS);
const pluginPrefs = storage.loadPluginPrefs(localStorage, DEFAULT_PLUGIN_PREFS);

const state = createState({ ui, apiKey, promptPresets, pluginPrefs });

const logger = createLogger(ui);
const selection = createSelection({ core, imaging, logLine: logger.logLine });
const placer = createPlacer({
  app,
  core,
  constants,
  fs,
  imaging,
  base64ToArrayBuffer: utils.base64ToArrayBuffer,
  logLine: logger.logLine
});

const generator = createGenerator({
  app,
  core,
  ui,
  state,
  selection,
  placer,
  generateWithProvider,
  critiqueWithProvider,
  logLine: logger.logLine,
  utils,
  seedreamModelId: [SEEDREAM, SEEDREAM_5],
  grokModelId: GROK_IMAGINE,
  nanoBananaModelId: NANOBANANA_PRO
});

async function openImageFolder() {
  const folder = await fs.getDataFolder();
  const result = await shell.openPath(folder.nativePath, "Open generated image folder");
  if (typeof result === "string" && result.length > 0) {
    throw new Error(result);
  }
  return folder.nativePath;
}

entrypoints.setup({
  commands: {},
  panels: {
    vanilla: {
      show() {}
    }
  }
});

initializeUI({
  ui,
  state,
  models: { SEEDREAM, SEEDREAM_5, NANOBANANA_PRO, GROK_IMAGINE },
  logger,
  storage,
  defaultChatPromptText: DEFAULT_CHAT_PROMPT
});

bindEvents({
  ui,
  state,
  models: { SEEDREAM, SEEDREAM_5, NANOBANANA_PRO, GROK_IMAGINE },
  logger,
  storage,
  generator,
  openImageFolder,
  selection,
  app,
  core,
  defaultPromptText: DEFAULT_PROMPT_PRESETS.default,
  defaultChatPromptText: DEFAULT_CHAT_PROMPT
});
