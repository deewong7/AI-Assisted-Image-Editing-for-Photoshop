const test = require("node:test");
const assert = require("node:assert/strict");
const { initializeUI, bindEvents } = require("../events.js");

function createCheckbox(initialChecked = false) {
  const listeners = {};
  return {
    checked: initialChecked,
    addEventListener(type, handler) {
      listeners[type] = handler;
    },
    click() {
      if (typeof listeners.click === "function") {
        listeners.click({ target: this });
      }
    }
  };
}

function createBaseArgs(ui, defaultChatPromptText = "DEFAULT CHAT PROMPT") {
  return {
    ui,
    state: {
      apiKey: {},
      promptPresets: {},
      persistGeneratedImages: false
    },
    models: {},
    logger: {
      logLine() {}
    },
    storage: {
      saveApiKeys() {},
      savePromptPresets() {},
      savePluginPrefs() {}
    },
    generator: {
      generate() {},
      critique() {}
    },
    selection: {},
    app: {
      activeDocument: {
        selection: {}
      }
    },
    core: {
      showAlert() {}
    },
    defaultPromptText: "DEFAULT PROMPT",
    defaultChatPromptText
  };
}

test.describe("critique prompt edit preference", () => {
  test("initializeUI locks critique prompt by default and resets it to default text", () => {
    const ui = {
      chatPromptInput: { value: "custom before init", disabled: false },
      enableCritiquePromptEdit: createCheckbox(true)
    };
    const args = createBaseArgs(ui, "LOCKED DEFAULT PROMPT");

    initializeUI(args);

    assert.equal(ui.enableCritiquePromptEdit.checked, false);
    assert.equal(ui.chatPromptInput.disabled, true);
    assert.equal(ui.chatPromptInput.value, "LOCKED DEFAULT PROMPT");
  });

  test("checking enableCritiquePromptEdit enables critique prompt editing", () => {
    const ui = {
      chatPromptInput: { value: "", disabled: false },
      enableCritiquePromptEdit: createCheckbox(false)
    };
    const args = createBaseArgs(ui, "LOCKED DEFAULT PROMPT");

    initializeUI(args);
    bindEvents(args);

    ui.chatPromptInput.value = "user custom prompt";
    ui.enableCritiquePromptEdit.checked = true;
    ui.enableCritiquePromptEdit.click();

    assert.equal(ui.chatPromptInput.disabled, false);
    assert.equal(ui.chatPromptInput.value, "user custom prompt");
  });

  test("unchecking enableCritiquePromptEdit disables editing and restores default prompt", () => {
    const ui = {
      chatPromptInput: { value: "", disabled: false },
      enableCritiquePromptEdit: createCheckbox(false)
    };
    const args = createBaseArgs(ui, "LOCKED DEFAULT PROMPT");

    initializeUI(args);
    bindEvents(args);

    ui.enableCritiquePromptEdit.checked = true;
    ui.enableCritiquePromptEdit.click();
    ui.chatPromptInput.value = "edited prompt";

    ui.enableCritiquePromptEdit.checked = false;
    ui.enableCritiquePromptEdit.click();

    assert.equal(ui.chatPromptInput.disabled, true);
    assert.equal(ui.chatPromptInput.value, "LOCKED DEFAULT PROMPT");
  });
});

test.describe("generated image persistence preference", () => {
  test("initializeUI reflects saved persistGeneratedImages state", () => {
    const ui = {
      chatPromptInput: { value: "", disabled: false },
      enableCritiquePromptEdit: createCheckbox(false),
      persistGeneratedImages: createCheckbox(false)
    };
    const args = createBaseArgs(ui);
    args.state.persistGeneratedImages = true;

    initializeUI(args);

    assert.equal(ui.persistGeneratedImages.checked, true);
  });

  test("clicking persistGeneratedImages updates state and saves preference", () => {
    const savedPrefs = [];
    const ui = {
      chatPromptInput: { value: "", disabled: false },
      enableCritiquePromptEdit: createCheckbox(false),
      persistGeneratedImages: createCheckbox(false)
    };
    const args = createBaseArgs(ui);
    args.storage.savePluginPrefs = (_storage, prefs) => {
      savedPrefs.push(prefs);
    };
    global.localStorage = {};

    initializeUI(args);
    bindEvents(args);

    ui.persistGeneratedImages.checked = true;
    ui.persistGeneratedImages.click();

    assert.equal(args.state.persistGeneratedImages, true);
    assert.deepEqual(savedPrefs, [{ persistGeneratedImages: true }]);
  });
});

test.describe("open image folder button", () => {
  test("calls openImageFolder and re-enables button on success", async () => {
    const logs = [];
    const ui = {
      openImageFolderButton: createCheckbox(false),
      chatPromptInput: { value: "", disabled: false },
      enableCritiquePromptEdit: createCheckbox(false)
    };
    const args = createBaseArgs(ui);
    args.logger.logLine = (...parts) => logs.push(parts.join(" "));

    let called = 0;
    args.openImageFolder = async () => {
      called += 1;
      return "/plugin/data";
    };

    bindEvents(args);

    ui.openImageFolderButton.click();
    await Promise.resolve();

    assert.equal(called, 1);
    assert.equal(ui.openImageFolderButton.disabled, false);
    assert.equal(logs.some(line => line.includes("Opened image folder:")), true);
  });

  test("shows alert and re-enables button when openImageFolder fails", async () => {
    const logs = [];
    const alerts = [];
    const ui = {
      openImageFolderButton: createCheckbox(false),
      chatPromptInput: { value: "", disabled: false },
      enableCritiquePromptEdit: createCheckbox(false)
    };
    const args = createBaseArgs(ui);
    args.logger.logLine = (...parts) => logs.push(parts.join(" "));
    args.core.showAlert = (message) => alerts.push(message);
    args.openImageFolder = async () => {
      throw new Error("cannot open");
    };

    bindEvents(args);

    ui.openImageFolderButton.click();
    await Promise.resolve();

    assert.equal(ui.openImageFolderButton.disabled, false);
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0], "Failed to open image folder. Check log for details.");
    assert.equal(logs.some(line => line.includes("Failed to open image folder:")), true);
  });
});
