const { entrypoints } = require("uxp");
const { app, core, constants } = require("photoshop");
const imaging = require("photoshop").imaging;
// const fs = require("fs")
const fs = require('uxp').storage.localFileSystem;
const { generateWithProvider } = require("./providers/index.js");

const SEEDREAM = "doubao-seedream-4-5-251128";
const NANOBANANA_PRO = "gemini-3-pro-image-preview";
const GROK_2_IMAGE = "grok-2-image";
const DEFAULT_API_KEYS = Object.freeze({
  "NanoBananaPro-api-key": "",
  "SeeDream-api-key": ""
});
let TEMPERATURE = 0.6;
let TOP_P = 0.95;

// multi image for reference or what
let IMAGE_ARRAY = [];
let SKIP_MASK = false;

// Model picker class="main"
const modelPicker = document.getElementById("modelPicker");
modelPicker.value = NANOBANANA_PRO;
let SELECTEDMODEL = modelPicker.value;

const resolutionPicker = document.getElementById("resolutionPicker");
let resolution = resolutionPicker.value; // "1K", "2K", "4K"
resolutionPicker.addEventListener("change", (e) => {
  resolution = e.target.value;
  console.log("Update resolution to:", resolution);
  logLine("Update resolution to:", resolution);
});
let adaptiveResolutionSetting = true;
let upgradeFactor = 1.5;

const aspectRatioPicker = document.getElementById("aspectRatioPicker");
let aspectRatio = aspectRatioPicker.value; // "1:1", "3:4" and etc
aspectRatioPicker.addEventListener("change", (e) => {
  aspectRatio = e.target.value;
  console.log("Update aspect ratio to:", aspectRatio);
  logLine("Update aspect ratio to:", aspectRatio);
});
let showModelParameters = false; // to give a clean user interface at glance

// read api key from api-key.json
// let apiKey = require("./api-key.json");
let apiKey = loadKeysFromLocalStorage();
let promptPresets = loadDefaultPresetFromLocalStorage();

entrypoints.setup({
  commands: {
  },
  panels: {
    vanilla: {
      show(node) {
      },
    },
  }
});

const promptInput = document.getElementById("promptInput");
const promptPicker = document.getElementById("promptPicker");
const generateButton = document.getElementById("generate");
const errorArea = document.getElementById("error");
const imageToProcess = document.getElementById("imageToProcess");

promptInput.addEventListener("input", () => {
  if (promptPicker?.selectedOptions?.length) {
    const menuItems = promptPicker.querySelectorAll("sp-menu-item");
    menuItems.forEach(item => item.removeAttribute("selected"));
  }
});

// Main function to call from your UI

// If a rectangular selection exists,
// Return ImageData object
async function getImageDataFromSelection(bounds) {
  // update the aspectRatio accordingly

  // 0. Inform the compression to 8-bits
  // if the original doc is 16-bits or 32-bits
  // if (doc.bitsPerChannel != 8) {
  //   console.log("Document is " + doc.bitsPerChannel + ", converting selected area to 8-bits per channel.");
  // }

  // 1. Ensure selection exists
  if (!bounds) {
    core.showAlert("No Selection.");
    throw new Error("No Selection");
  }

  // 2. Get image data from selection
  try {
    const result = await imaging.getPixels({
      sourceBounds: {
        left: bounds.left,
        top: bounds.top,
        right: bounds.right,
        bottom: bounds.bottom
      },
      applyAlpha: true,
      // colorSpace not working as expected when dealing with ProRGB/16-Bit images
    });
    console.log("image data obtained from selection.");
    return result.imageData;
  } catch (error) {
    console.log("error getting image data from selection: " + error);
    throw error;
  }

}

// Return Base64 string of an ImageData
async function getImageDataToBase64(bounds) {

  return core.executeAsModal(async () => {
    let imageData = null;
    try {
      imageData = await getImageDataFromSelection(bounds);
    } catch (error) {
      console.error("Error getting imageData from selection: " + error);
      return "";
    }

    try {
      // Only allowed from inside a modal
      // https://www.adobe.com/go/ps_executeasmodal
      const base64Data = await imaging.encodeImageData(
        {
          imageData: imageData,
          base64: true
        }
      )
      return base64Data;

    } catch (error) {
      console.error(error);
      logLine(error.message);
      throw error;
    } finally {
      // Calling this synchronous method will release the contained image data.
      // Doing so will reduce memory usage faster than waiting for the JavaScript garbage collector to run.
      if (imageData) {
        imageData.dispose();
      }
    }
  });
}

// As the API server returns Base64 representation of image,
// we need to convert it to ArrayBuffer for UXP file write
function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  logLine("Received server byte length: " + bytes.byteLength)
  console.log("converted base64 to buffer, byte length: " + bytes.byteLength);
  return bytes.buffer;
}

// 1. Read the server returned base64 string
// 2. save to a temporary file
// 3. place it on the document
async function placeToCurrentdocAtSelection(base64, bounds, suffix = "") {
  if (!base64 || base64?.length === 0) {
    console.log("No base64 data to place.");
    return;
  }

  // Convert Base64 to a temporary file path (UXP requires a file)
  const tmpFolder = await fs.getTemporaryFolder();
  // if host is not in a modal state,
  // the files should be saved at least
  // so it should not be inside executeAsModal
  const fileNameNoExt = `tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const fileName = `${fileNameNoExt}.png`;
  const tmpFile = await tmpFolder.createFile(fileName,
    { overwrite: true }
  );
  await tmpFile.write(base64ToArrayBuffer(base64));
  console.log("Written base64 to tmp file..., length" + base64.length);
  console.log("API generated image is written at:\n" + tmpFile.nativePath);
  logLine("API generated image is written at:\n" + tmpFile.nativePath);

  // place the tmp file to current document
  try {
    await core.executeAsModal(async () => {

      const sessionToken = fs.createSessionToken(tmpFile);
      console.log("session token created: " + sessionToken);

      // select the topmost layer
      // Select layer topmostlayer
      const selectCommand =
      {
        "_obj": "select",
        "_target": [
          {
            "_id": app.activeDocument.layers[0].id,
            "_ref": "layer"
          }
        ],
        "layerID": [
          app.activeDocument.layers[0].id
        ],
        "makeVisible": false
      }
      // set selection then place
      const setSelectionCommand = {
        // copied from Convert To JavaScript by Photoshop App
        // Set Selection
        "_obj": "set",
        "_target": [
          {
            "_property": "selection",
            "_ref": "channel"
          }
        ],
        "to": {
          "_obj": "rectangle",
          "bottom": {
            "_unit": "pixelsUnit",
            "_value": bounds.bottom
          },
          "left": {
            "_unit": "pixelsUnit",
            "_value": bounds.left
          },
          "right": {
            "_unit": "pixelsUnit",
            "_value": bounds.right
          },
          "top": {
            "_unit": "pixelsUnit",
            "_value": bounds.top
          }
        },
      }

      const placeCommand = {
        _obj: "placeEvent",
        null: { _path: sessionToken, _kind: "local" },
        linked: false
      }

      // set selection then place 
      const result = await app.batchPlay(
        [
          selectCommand,
          setSelectionCommand,
          placeCommand
        ],
        { synchronousExecution: true }
      );

      // scale and translate placed layer
      const layers = app.activeDocument.layers;
      let placedLayer;
      placedLayer = app.activeDocument.activeLayers[0]; // place event automatically select the placed one, but is it guaranteed?

      // what if the target layer is inside a group?
      // placedLayer = layers.getByName(fileNameNoExt);

      // if (!placedLayer) {
      //   if (result[0]?.ID) {
      //     placedLayer = layers.find(layer => layer.id === result[0].ID);
      //   } else {
      //     console.error("batchPlay failed to place the generated layer")
      //   }
      // }

      if (!placedLayer) {
        console.error("NO LAYER PLACED WHY?")
        logLine("Error: no layer placed after batchPlay!")
        return
      }
      // const placedLayer = app.activeDocument.activeLayers[0];

      // reize
      placedLayer.scale(bounds.width / placedLayer.bounds.width * 100, bounds.height / placedLayer.bounds.height * 100);

      placedLayer.move(app.activeDocument.layers[0], constants.ElementPlacement.PLACEBEFORE);
      // placedLayer.bringToFront();

      // naming index
      // should have find the max one
      let layerSuffix = 1;
      for (let i = 0; i < layers.length; i++) {
        const layer = layers[i];
        if (layer.name.startsWith("Generated Image")) {
          layerSuffix += 1;
        }
      }

      placedLayer.name = `Generated Image ${layerSuffix} - ${suffix}`;

      // deprecated for applying gaussain blur mask afterplacement which require active layer selected to be the generated image layer
      // should preserve previous layer's visible state
      // const visibleState = layerBeforePlacing.visible
      // layerBeforePlacing.selected = true; // reselect previous layer
      // layerBeforePlacing.visible = visibleState
      // placedLayer.selected = false; // deselect placed layer

      await applyMaskWithGaussianBlur(placedLayer, bounds);

      // preserve selection?
      // app.activeDocument.selection.deselect();

    })
  } catch (error) {
    if (error.message.includes("modal state")) {
      logLine("Cannot place the generated image because host is in modal state, but the file has been saved. Check the log for path of the file.")
    }
    console.error(error);
  }
}

// adaptive res
const BASE = {
  "1K": 1024,
  "2K": 2048,
  "4K": 4096
};
function pickTier(longEdge, upgradeFactor = 1.5) {
  if (longEdge <= BASE["1K"] * upgradeFactor) {
    if (SELECTEDMODEL === SEEDREAM) {
      return "2K";
    }
    return "1K";
  }
  if (longEdge <= BASE["2K"] * upgradeFactor) {
    return "2K";
  }
  return "4K";
}


// Main gen
async function generate() {
  // test
  if (document.getElementById("test").checked) {
    SELECTEDMODEL = "localtest";
    generateButton.innerText = "Test";
  }

  const selection = app.activeDocument.selection;
  if (!selection?.bounds) {
    core.showAlert("No Selection.");
    return;
  }

  const targetModel = SELECTEDMODEL;
  // at the moment, bounds is guaranteed not null
  const bounds = {
    left: selection.bounds.left,
    right: selection.bounds.right,
    top: selection.bounds.top,
    bottom: selection.bounds.bottom,
    width: selection.bounds.width,
    height: selection.bounds.height
  }

  if (adaptiveResolutionSetting) {
    const upgradeFactorValue = parseFloat(document.getElementById("upgradeFactorSlider").value);
    upgradeFactor = Number.isFinite(upgradeFactorValue) ? upgradeFactorValue : 1.5;
    resolution = pickTier(Math.max(bounds.width, bounds.height), upgradeFactor);
  }

  // "Make this image a fantasy style painting"
  const prompt = promptInput.value.trim();
  // check prompt
  if (prompt === "") {
    core.showAlert("Please input prompt.");
    return;
  }

  console.log("Prompt: " + prompt);
  logLine("-----" + SELECTEDMODEL + "-----");

  // flush previous error on clicking
  errorArea.innerText = "";
  errorArea.style.display = "none";


  // perhaps disable generate button
  generateButton.disabled = true;

  let base64Data;
  try {
    base64Data = await getImageDataToBase64(bounds);
  } catch (error) {
    logLine("Check log for more detailed error message.");
  } finally {
    // release generate button
    generateButton.disabled = false;
  }

  if (!base64Data || base64Data.length === 0) {
    console.log("No base64 data obtained from selection. Aborting.");
    logLine("No base64 data obtained from selection. Aborting.");
    return;
  } else {
    // preview selected image
    imageToProcess.innerHTML = "<image src='data:image/png;base64," + base64Data + "'</image>";
    console.log("image base64 length: " + base64Data.length);
  }

  // FETCH FROM REMOTE API
  // Expect to get back base64 string
  let generatedBase64 = null;
  try {

    logLine("Fetching " + resolution + " image to " + SELECTEDMODEL);
    if (SELECTEDMODEL === "localtest") {
      // generatedBase64 = base64Data; // for local testing
      // return the original

      const sleep = ms => new Promise(r => setTimeout(r, ms));
      await sleep(3000);
      generatedBase64 = base64Data;

    } else {
      const temperatureInput = parseFloat(document.getElementById("temperature").value);
      const topPInput = parseFloat(document.getElementById("top_p").value);
      TEMPERATURE = Number.isFinite(temperatureInput) ? temperatureInput : 1.0;
      TOP_P = Number.isFinite(topPInput) ? topPInput : 0.90;
      generatedBase64 = await generateWithProvider(SELECTEDMODEL, {
        prompt,
        base64Image: base64Data,
        resolution,
        aspectRatio,
        referenceImages: IMAGE_ARRAY,
        apiKey,
        showModelParameters,
        temperature: TEMPERATURE,
        topP: TOP_P,
        logLine
      });
    }
  } catch (error) {
    console.error("Error during remote API call: " + error);
    // document.getElementById("error").style.display = "";
    // document.getElementById("error").innerText = "Error during remote API call:\n" + error.message;
    logLine("Error during remote API call:\n" + error.message);
    return;
  } finally {
  }

  try {
    console.log("placing generated image to document, length: ", generatedBase64.length);
    logLine("Placing server generated image to document, length: " + generatedBase64.length);
    // bounds not null
    await placeToCurrentdocAtSelection(generatedBase64, bounds, targetModel);
  } catch (error) {
    console.error("Error placing generated image to document: " + error);
    logLine("Error placing generated image to document: " + error)
    // document.getElementById("error").innerText = "Error placing generated image to document:\n" + error.message;
    return;
  }

}

async function applyMaskWithGaussianBlur(layer, bounds, radius = 0.10) {
  const doc = app.activeDocument;
  if (SKIP_MASK || (bounds.width === doc.width && bounds.height === doc.height)) {
    return;
  }
  if (radius >= 1) {
    return;
  }
  await core.executeAsModal(async () => {
    try {

      // TODO: update to imaging.getSelection(bounds) and putSelection
      const maskWidth = Math.max(1, Math.round(bounds.width * (1 - radius)));
      const maskHeight = Math.max(1, Math.round(bounds.height * (1 - radius)));
      const offsetX = Math.round((bounds.width - maskWidth) / 2);
      const offsetY = Math.round((bounds.height - maskHeight) / 2);
      const maskBounds = {
        left: bounds.left + offsetX,
        top: bounds.top + offsetY,
        right: bounds.left + offsetX + maskWidth,
        bottom: bounds.top + offsetY + maskHeight
      };

      const bufferBlack = new Uint8Array(doc.width * doc.height);
      bufferBlack.fill(0);

      const bufferWhite = new Uint8Array(maskWidth * maskHeight);
      bufferWhite.fill(255);

      const imageDataBlack = await imaging.createImageDataFromBuffer(
        bufferBlack,
        {
          width: doc.width,
          height: doc.height,
          components: 1,
          colorSpace: "Grayscale",
          chunky: true
        }
      )

      const imageDataWhite = await imaging.createImageDataFromBuffer(
        bufferWhite,
        {
          width: maskWidth,
          height: maskHeight,
          components: 1,
          colorSpace: "Grayscale",
          chunky: true
        }
      )

      try {
        // documentID?: number;
        // layerID: number;
        // kind?: "user";
        // imageData: PhotoshopImageData;
        // replace?: boolean;
        // targetBounds?: BoundsSize | Bounds;
        // commandName?: string;

        await imaging.putLayerMask({
          layerID: layer.id,
          imageData: imageDataBlack,
          commandName: "Apply Mask to Generated Image Black"
        });

        // adding white
        await imaging.putLayerMask({
          layerID: layer.id,
          imageData: imageDataWhite,
          targetBounds: maskBounds,
          replace: false,
          commandName: "Apply Mask to Generated Image White"
        });
        const K = 0.015;
        // 0 - 1000px
        // layer.layerMaskFeather = 1000 * radius * maskFeatherConstant;
        layer.layerMaskFeather = K * maskWidth;

        imageDataBlack.dispose();
        imageDataWhite.dispose();

      } catch (error) {
        console.error("cannot putlayermask", error);
      }

    } catch (e) {
      console.error(e);
    }
  });
}

function test(e) {
  if (e.target.checked) {
    SELECTEDMODEL = "localtest";
    // update the button to yellow bg
    generateButton.innerText = "TEST";
    generateButton.style.backgroundColor = "#f26c4f";
    promptInput.value = "TEST";
  } else {
    SELECTEDMODEL = modelPicker.value;
    generateButton.innerText = "Generate";
    generateButton.style.backgroundColor = '';
    promptInput.value = "";
  }
  updateModel(SELECTEDMODEL);
}

// try to specify class and query them all
function updateModel(model) {
  if (typeof model === 'undefined') return;

  if (model === SEEDREAM) {

    // bytedance specified
    document.getElementById("1K").style.display = "none";
    // upgrade
    document.getElementById("2K").selected = true;
    resolution = "2K";
  } else {
    document.getElementById("1K").style.display = "";
  }

  document.getElementById('googleModel').style.display = (model === NANOBANANA_PRO && showModelParameters) ? '' : 'none';

  if (model === GROK_2_IMAGE) {
    document.getElementById("allowNSFW").style.display = "";
    document.getElementById("2K").selected = true;
    document.getElementById("4K").style.display = 'none';
  } else {
    document.getElementById("4K").style.display = "";
    document.getElementById("allowNSFW").style.display = "none";
  }

  // untest
  if (model !== "localtest") {
    document.getElementById("test").checked = false;
    generateButton.innerText = 'Generate';
    generateButton.style.backgroundColor = '';
  }

  console.log('Update model to:', SELECTEDMODEL, resolution);
  logLine('Update model to:', SELECTEDMODEL, resolution);
}

function lockParameter(e) {
  if (e.target.checked) {
    document.getElementById("temperature").disabled = true;
    document.getElementById("top_p").disabled = true;
  } else {
    document.getElementById("temperature").disabled = false;
    document.getElementById("top_p").disabled = false;
  }
}

function getCurrentTime() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `[${hours}:${minutes}:${seconds}]`;
}

function logLine(...text) {
  let result;
  if (text.length > 1) {
    result = text.join(" ");
  } else {
    result = text[0];
  }

  if (typeof result === "string") {
    result = getCurrentTime() + " " + result;
    const logArea = document.getElementById("log");
    logArea.value = result + "\n" + logArea.value;

    // logArea.scrollTop = logArea.scrollHeight;
  }
}

function clearLog() {
  const logArea = document.getElementById("log");
  logArea.value = "";

}

function toggleLog(e) {
  // document.getElementById("log").style.display = e.target.checked ? "none" : "";
  // document.getElementById("clearLog").style.display = e.target.checked ? "none" : "";
  const logs = document.getElementsByClassName("logArea");
  for (const el of logs) {
    el.style.display = e.target.checked ? "none" : "";
  }
}

const keyMap = {
  "api-key-google": "NanoBananaPro-api-key",
  "api-key-bytedance": "SeeDream-api-key"
};

async function updateAPIKey(update = true) {
  let changed = false;

  for (const [inputId, keyName] of Object.entries(keyMap)) {
    const el = document.getElementById(inputId);
    if (!el) continue;

    // display masked value (load mode)
    if (!update) {
      if (typeof apiKey[keyName] === "string" && apiKey[keyName].length > 0) {
        el.valid = true;
      }
      continue;
    }

    // update mode
    const value = el.value?.trim();
    if (!value) continue;

    apiKey[keyName] = value;
    el.value = "";
    el.valid = true;
    changed = true;
  }

  if (update && changed) {
    saveKeysToLocalStorage();
  }
}

updateAPIKey(false);

// TODO:
// TODO: Add option to save the generated image to a given directory or local storage
// FEAT: Adaptive resolution based on selection size
// TODO: Store previous prompt into localStorage?

// DONE: remember selection (using thread safe queue or pass by function?) not possible using the placement event
// DONE: Apply gaussian blur with the selection/mask


// Page tabs
const pages = document.querySelectorAll("sp-div[data-page]");
const menuItems = document.querySelectorAll("sp-action-button[data-page]");

document.getElementById("nav").addEventListener("click", e => {
  const btn = e.target.closest("sp-action-button");
  if (!btn) return;

  pages.forEach(p => {
    p.hidden = p.id !== btn.dataset.page;
  });

  menuItems.forEach(m => {
    m.style.textDecoration = m === btn ? "underline" : "none";
  });

});

document.getElementById("loadPrompt")?.addEventListener("click", e => {
  promptInput.value = `现在你是一个Cosplay图片后期师，你需要按照以下规则进行处理：
	1.身材调整：对模特的胸部、腰部、臀部等部位进行适度膨胀，让模特的身材更加丰满且自然。
	2.头发优化：消除头发中所有不和谐的杂乱部分，在原有发型基础上增加3-5缕随微风飘动的头发，使头发材质呈现超写实、精致的CG质感。
	3.道具材质调整：
	所有塑料道具赋予金属质感，同时保留原有颜色。
	所有皮质材质变得更精致、更有质感。
	4.面部与皮肤美化：
	对模特进行皮肤和美颜调整，消除双下巴。
	优化下颌线，使其轮廓清晰。
	调整肌肤纹理均匀精致，弱化唇纹。
	根据模特所Cos角色判断原人设的人种特征，并进行对应风格的补妆。
	5.灯光调整：
	在现有灯光基础上增加轮廓光和补充光，以更好地展示服装材质、轮廓和人物边缘。
	让模特面部光线柔和，尽可能减弱面部投影。
	6.服装与布料优化：
	移除模特服装上的所有褶皱和污渍，让布料材质崭新柔顺。
	对裙摆、飘带等容易被风吹动的部位，适当增加飘动效果。`
});

document.getElementById("skipMask").addEventListener("click", e => {
  SKIP_MASK = e.target.checked;
});

// GENERATE BUTTON CLICK EVENT
generateButton.addEventListener("click", generate);
document.getElementById("clear").addEventListener("click", () => {
  imageToProcess.innerHTML = "";
});
document.getElementById("test").addEventListener("click", test);
document.getElementById("lockParam").addEventListener("click", lockParameter);
document.getElementById("clearLog").addEventListener("click", clearLog);
document.getElementById("hideLog").addEventListener("click", toggleLog);

document.getElementById("update-api-key").addEventListener("click", updateAPIKey);
document.getElementById("showKey").addEventListener("click", (e) => {
  for (const [inputId, keyName] of Object.entries(keyMap)) {
    const inputField = document.getElementById(inputId);
    inputField.value = e.target.checked ? apiKey[keyName] : "";
  }
});

modelPicker.addEventListener("change", (e) => {
  SELECTEDMODEL = e.target.value;
  updateModel(SELECTEDMODEL);
});
updateModel(SELECTEDMODEL);


function saveKeysToLocalStorage() {
  localStorage.setItem("apiKeys", JSON.stringify(apiKey));
}

function loadKeysFromLocalStorage() {
  const raw = localStorage.getItem("apiKeys");
  if (!raw) {
    return { ...DEFAULT_API_KEYS };
  }

  try {
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_API_KEYS, ...parsed };
  } catch {
    return { ...DEFAULT_API_KEYS };
  }
}

async function pushReferenceImage() {
  try {
    const selection = app.activeDocument.selection;
    if (!selection?.bounds) {
      core.showAlert("No Selection.");
      return;
    }
    const imageBase64 = await getImageDataToBase64(selection.bounds);
    IMAGE_ARRAY.push(imageBase64);

    const container = document.getElementById("refImagePreview");
    const img = document.createElement("img");
    img.src = "data:image/png;base64," + imageBase64;
    img.style.width = "55";
    img.style.height = "55";
    img.style.flex = "0 0 auto"; // prevents shrinking
    container.appendChild(img);

    document.getElementById("refImagePreviewDiv").style.display = "";
    document.getElementById("refCount").innerText = `Reference Image Preview Count: ${IMAGE_ARRAY.length}`;
  } catch (error) {
    console.error("Failed to add reference image:", error);
  }
}

function clearReferenceImage() {
  IMAGE_ARRAY = [];
  document.getElementById("refImagePreview").innerHTML = "";
  document.getElementById("refImagePreviewDiv").style.display = "none";
  document.getElementById("refCount").innerText = `Reference Image Preview`;
}

// TODO: save pref to localStorage
// is localStorage shared by all plugins or just one per pluginID?

// ratio
document.getElementById("adaptiveRatioSetting").addEventListener("click", (e) => {
  document.getElementById("ratioPicker").style.display = e.target.checked ? '' : 'none';
  if (document.getElementById("ratioPicker").style.display === 'none') {
    aspectRatio = "default";
    document.getElementById("ratioPicker").value = "default";
    document.getElementById("ratioPicker").selectedIndex = 0;
  }
});

document.getElementById("showModelParameter").addEventListener("click", (e) => {
  showModelParameters = e.target.checked;
  updateModel(SELECTEDMODEL);
});


document.getElementById("adaptiveResolutionSetting").addEventListener("click", (e) => {
  document.getElementById("resolutionPickerArea").style.display = e.target.checked ? '' : 'none';

  adaptiveResolutionSetting = !e.target.checked;
  document.getElementById("upgradeFactorSlider").disabled = e.target.checked;

  // if disabled
  if (e.target.checked) {
    resolution = document.getElementById("resolutionPicker").value;
  }

});

document.getElementById("previewImage").addEventListener("click", (e) => {
  document.getElementById("imagePreview").style.display = e.target.checked ? '' : 'none';
});

document.getElementById("reference").addEventListener("click", pushReferenceImage);
document.getElementById("clearReference").addEventListener("click", clearReferenceImage);

document.getElementById("referenceImageSetting").addEventListener("click", (e) => {
  document.getElementById("referenceImage").style.display = e.target.checked ? '' : 'none';
  if (!e.target.checked) {
    clearReferenceImage();
  }
});


/**
 * localStorage.getItem("promptPresets")
 * preset {
 *   name: value
 * }
 */
function loadDefaultPresetFromLocalStorage() {

  // only if there is not a preset object inside localstorage
  const raw = localStorage.getItem('promptPresets');
  const defaultPresets = {
    // name: "value"
    // from 夏三七抖音直播间
    default: `现在你是一个Cosplay图片后期师，你需要按照以下规则进行处理：
	1.身材调整：对模特的胸部、腰部、臀部等部位进行适度膨胀，让模特的身材更加丰满且自然。
	2.头发优化：消除头发中所有不和谐的杂乱部分，在原有发型基础上增加3-5缕随微风飘动的头发，使头发材质呈现超写实、精致的CG质感。
	3.道具材质调整：
	所有塑料道具赋予金属质感，同时保留原有颜色。
	所有皮质材质变得更精致、更有质感。
	4.面部与皮肤美化：
	对模特进行皮肤和美颜调整，消除双下巴。
	优化下颌线，使其轮廓清晰。
	调整肌肤纹理均匀精致，弱化唇纹。
	根据模特所Cos角色判断原人设的人种特征，并进行对应风格的补妆。
	5.灯光调整：
	在现有灯光基础上增加轮廓光和补充光，以更好地展示服装材质、轮廓和人物边缘。
	让模特面部光线柔和，尽可能减弱面部投影。
	6.服装与布料优化：
	移除模特服装上的所有褶皱和污渍，让布料材质崭新柔顺。
	对裙摆、飘带等容易被风吹动的部位，适当增加飘动效果。`
  };

  if (!raw) {
    localStorage.setItem('promptPresets', JSON.stringify(defaultPresets));
    return defaultPresets;
  }

  try {
    return JSON.parse(raw);
  } catch {
    localStorage.setItem('promptPresets', JSON.stringify(defaultPresets));
    return defaultPresets;
  }
}

function savePromptPresetToLocalStorage() {
  localStorage.setItem('promptPresets', JSON.stringify(promptPresets));
}

function onloadPreset() {
  const pickerMenu = promptPicker;

  // Populate the menu
  Object.keys(promptPresets).forEach(key => {
    const item = document.createElement("sp-menu-item");
    item.name = key;
    item.textContent = key;
    item.value = promptPresets[key];
    pickerMenu.appendChild(item);
  });
}

onloadPreset();

promptPicker.addEventListener("change", (e) => {

  // 1
  const selected = e.target.value;
  if (selected) {
    document.getElementById("promptPresetTextarea").value = selected;
    document.getElementById("newPresetName").value = e.target.selectedOptions[0]?.name;
  }

  // 2
  promptInput.value = document.getElementById("promptPresetTextarea").value;

});

document.getElementById("editPromptButton").addEventListener("click", (e) => {
  // const div = document.getElementById("promptPresetDiv");
  // div.style.display = div.style.display === "" ? "none" : "";
  const div = document.getElementById("newPresetTextDiv");
  div.style.display = div.style.display === "none" ? "" : "none";

  // 2
  // hide original prompt input area

  // if it is already hidden by disable Customised Prompt, do nothing

  if (document.getElementById("enablePrompt").checked) {
    promptInput.style.display = promptInput.style.display === "" ? "none" : "";
    generateButton.style.display = generateButton.style.display === "" ? "none" : "";
  }

});

document.getElementById("savePromptPreset").addEventListener("click", (e) => {
  const pickerMenu = promptPicker;
  const textarea = document.getElementById("promptPresetTextarea");
  const textfield = document.getElementById("newPresetName");

  const key = textfield.value.trim() || pickerMenu.selectedOptions[0]?.name;
  const value = textarea.value;
  if (!value) {
    core.showAlert("Please input preset value.");
    return;
  }
  if (!textfield.value.trim()) {
    core.showAlert("Please input preset name.");
    return;
  }

  // Save to the object
  promptPresets[key] = value;
  savePromptPresetToLocalStorage();

  // Add to the menu if not exist
  let exists = false;
  const items = pickerMenu.querySelectorAll("sp-menu-item");
  items.forEach(item => {
    if (item.textContent === key) {
      exists = true;
      item.value = value;
      pickerMenu.value = value;
      pickerMenu.selectedIndex = pickerMenu.options.length - 1;
      item.selected = true;
    }
  });
  if (!exists) {
    const item = document.createElement("sp-menu-item");
    item.name = key;
    item.textContent = key;
    item.value = value;
    pickerMenu.appendChild(item);
    // unselect the current
    pickerMenu.value = value;
    pickerMenu.selectedIndex = pickerMenu.options.length - 1;
    item.selected = true;
  } else {
  }

  // Clear input fields
  // textfield.value = "";
  // textarea.value = "";
  // document.getElementById("newPresetTextDiv").style.display = "none";

  // 2
  promptInput.value = textarea.value;
  // promptInput.style.display = promptInput.style.display === "" ? "none" : "";
  // generateButton.style.display = generateButton.style.display === "" ? "none" : "";
});


document.getElementById("deletePromptButton").addEventListener("click", (e) => {

  const pickerMenu = promptPicker;
  const textarea = document.getElementById("promptPresetTextarea");

  const value = pickerMenu.value;
  const presetKeyToDelete = pickerMenu?.selectedOptions?.[0]?.name;

  // Delete from the object
  if (presetKeyToDelete && promptPresets[presetKeyToDelete]) {
    delete promptPresets[presetKeyToDelete];
    localStorage.setItem("promptPresets", JSON.stringify(promptPresets));
  }

  // Remove corresponding menu item
  const items = pickerMenu.querySelectorAll("sp-menu-item");
  items.forEach(item => {
    if (item.textContent === presetKeyToDelete) {
      item.remove();
    }
  });

  // Clear textarea if it was showing the deleted preset
  if (textarea.value === value) {
    textarea.value = "";
  }

  // clear textfield
  document.getElementById("newPresetName").value = "";
  if (value === promptInput.value) {
    promptInput.value = "";
  }
});


document.getElementById("enablePrompt").addEventListener("click", (e) => {

  // show or hide prompt area and button
  promptInput.style.display = e.target.checked ? "" : "none";

  // document.getElementById("generateBtnDiv").classList.toggle("right");

});

document.getElementById("hidePromptPreset").addEventListener("click", (e) => {
  const div = document.getElementById("promptManage");
  div.style.display = e.target.checked ? "none" : "";
});
