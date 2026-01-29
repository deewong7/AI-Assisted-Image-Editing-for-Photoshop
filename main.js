const { entrypoints } = require("uxp");
const { app, core, constants } = require("photoshop");
const imaging = require("photoshop").imaging;
const fs = require("uxp").storage.localFileSystem;

const utils = require("./utils");
const { generateWithProvider } = require("./providers/index.js");
const { createSelection } = require("./photoshop/selection");
const { createPlacer } = require("./photoshop/place");
const { createLogger } = require("./log");
const storage = require("./storage");
const { getUI } = require("./ui");
const {
  SEEDREAM,
  NANOBANANA_PRO,
  GROK_2_IMAGE,
  DEFAULT_API_KEYS,
  DEFAULT_PROMPT_PRESETS,
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

const state = createState({ ui, apiKey, promptPresets });

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
  logLine: logger.logLine,
  utils,
  seedreamModelId: SEEDREAM
});

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
  models: { SEEDREAM, NANOBANANA_PRO, GROK_2_IMAGE },
  logger,
  storage
});

bindEvents({
  ui,
  state,
  models: { SEEDREAM, NANOBANANA_PRO, GROK_2_IMAGE },
  logger,
  storage,
  generator,
  selection,
  app,
  core,
  defaultPromptText: DEFAULT_PROMPT_PRESETS.default
});
