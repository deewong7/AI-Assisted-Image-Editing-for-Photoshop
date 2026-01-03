const { entrypoints } = require("uxp");
const { app, core, constants } = require("photoshop");
const imaging = require("photoshop").imaging;
// const fs = require("fs")
const fs = require('uxp').storage.localFileSystem

const SEEDREAM = "doubao-seedream-4-5-251128";
const NANOBANANA_PRO = "gemini-3-pro-image-preview";
let TEMPERATURE = 0.6;
let TOP_P = 0.95;

let SKIP_MASK = false;

// Model picker
const modelPicker = document.getElementById("modelPicker");
modelPicker.value = NANOBANANA_PRO;
let SELECTEDMODEL = modelPicker.value;
modelPicker.addEventListener("change", (e) => {
  SELECTEDMODEL = e.target.value;
  updateModel(SELECTEDMODEL)
});

const resolutionPicker = document.getElementById("resolutionPicker");
let resolution = resolutionPicker.value; // "1K", "2K", "4K"
resolutionPicker.addEventListener("change", (e) => {
  resolution = e.target.value;
  console.log("Update resolution to:", resolution);
  logLine("Update resolution to:", resolution);
})

const aspectRatioPicker = document.getElementById("aspectRatioPicker")
let aspectRatio = aspectRatioPicker.value // "1:1", "3:4" and etc
aspectRatioPicker.addEventListener("change", (e) => {
  aspectRatio = e.target.value;
  console.log("Update aspect ratio to:", aspectRatio);
  logLine("Update aspect ratio to:", aspectRatio);
})

// read api key from api-key.json
// let apiKey = require("./api-key.json");
let apiKey = loadKeysFromLocalStorage();

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

// Main function to call from your UI

// If a rectangular selection exists,
// Return ImageData object
async function getImageDataFromSelection(bounds) {
  return new Promise(async (resolve, reject) => {

    // update the aspectRatio accordingly

    // 0. Inform the compression to 8-bits
    // if the original doc is 16-bits or 32-bits
    // if (doc.bitsPerChannel != 8) {
    //   console.log("Document is " + doc.bitsPerChannel + ", converting selected area to 8-bits per channel.");
    // }


    // 1. Ensure selection exists
    if (!bounds) {
      core.showAlert("No Selection.");
      reject("No Selection");
    }

    // 2. Get image data from selection
    imaging.getPixels({
      sourceBounds: {
        left: bounds.left,
        top: bounds.top,
        right: bounds.right,
        bottom: bounds.bottom
      },
      applyAlpha: true,
      // colorSpace not working as expected when dealing with ProRGB/16-Bit images
    })
      .then((result) => {
        console.log("image data obtained from selection.");
        resolve(result.imageData);
      })
      .catch((error) => {
        console.log("error getting image data from selection: " + error);
        reject(error);
      });

  });

}

// Return Base64 string of an ImageData
async function getImageDataToBase64(bounds) {

  return await core.executeAsModal(async () => {
    let imageData = null;
    try {
      imageData = await getImageDataFromSelection(bounds);
    } catch (error) {
      console.error("Error getting imageData from selection: " + error);
      return ""
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
      imageData.dispose();
    }
  })
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
async function placeToCurrentdocAtSelection(base64, bounds) {
  if (!base64 || base64?.length == 0) {
    console.log("No base64 data to place.");
    return;
  }

  console.log("writing base64 to tmp file..., length" + base64.length);

  // Convert Base64 to a temporary file path (UXP requires a file)
  const tmpFolder = await fs.getTemporaryFolder();
  const tmpFile = await tmpFolder.createFile("tmp.png", { overwrite: true });
  await tmpFile.write(base64ToArrayBuffer(base64));
  console.log("API generated image is written at:\n" + tmpFile.nativePath);
  logLine("API generated image is written at:\n" + tmpFile.nativePath);

  // place to bounds
  if (!bounds) {
    throw new Error("No Selection");
  }
  const width = bounds.width;
  const height = bounds.height;

  // place the tmp file to current document
  try {
    const sessionToken = fs.createSessionToken(tmpFile);
    // console.log("session token created: " + sessionToken);
    await core.executeAsModal(async () => {

      // deprecated for applying gaussain blur mask afterplacement which require active layer selected to be the generated image layer
      // will go back to this layer after placing
      // const layerBeforePlacing = app.activeDocument.activeLayers[0];

      // naming index
      let layerSuffix = 0;
      let layers = app.activeDocument.layers;
      for (let i = 0; i < layers.length; i++) {
        const layer = layers[i];
        if (layer.name.startsWith("Generated Image")) {
          layerSuffix += 1;
        }
      }

      // place only, require an active selection
      if (!app.activeDocument.selection.bounds) {
        console.log("Redo selection", bounds)
        await redoSelection(bounds)
      }
      await app.batchPlay(
        [{
          _obj: "placeEvent",
          null: { _path: sessionToken, _kind: "local" },
          linked: false
        }],
        { synchronousExecution: true }
      );

      // scale and translate placed layer
      const placedLayer = app.activeDocument.activeLayers[0];

      // reize
      placedLayer.scale(width / placedLayer.bounds.width * 100, height / placedLayer.bounds.height * 100);

      placedLayer.move(app.activeDocument.layers[0], constants.ElementPlacement.PLACEBEFORE);
      placedLayer.name = layerSuffix == 0 ? "Generated Image" : `Generated Image ${layerSuffix}`;

      // deprecated for applying gaussain blur mask afterplacement which require active layer selected to be the generated image layer
      // should preserve previous layer's visible state
      // const visibleState = layerBeforePlacing.visible
      // layerBeforePlacing.selected = true; // reselect previous layer
      // layerBeforePlacing.visible = visibleState
      // placedLayer.selected = false; // deselect placed layer

    })
  } catch (error) {
    console.error(error);
  }
}

// Main gen
async function generate() {
  // test
  if (document.getElementById("test").checked) {
    SELECTEDMODEL = "localtest";
  }

  if (!app.activeDocument.selection.bounds) {
    core.showAlert("No Selection.");
    return
  }

  const selection = app.activeDocument.selection;
  const bounds = {
    left: selection.bounds.left,
    right: selection.bounds.right,
    top: selection.bounds.top,
    bottom: selection.bounds.bottom,
    width: selection.bounds.width,
    height: selection.bounds.height
  }

  // "Make this image a fantasy style painting"
  const prompt = document.getElementById("promptInput").value;
  console.log("Prompt: " + prompt);
  logLine("-----" + SELECTEDMODEL + "-----")
  logLine("Prompt: " + prompt);

  // check prompt
  if (prompt === "") {
    core.showAlert("Please input prompt.");
    return
  }

  // flush previous error on clicking
  document.getElementById("error").innerText = "";
  document.getElementById("error").style.display = "none";


  // perhaps disable generate button
  document.getElementById("generate").disabled = true;

  const base64Data = await getImageDataToBase64(bounds);

  if (!base64Data || base64Data.length == 0) {
    console.log("No base64 data obtained from selection. Aborting.");
    return;
  } else {
    // preview selected image
    document.getElementById("imageToProcess").innerHTML = "<image src='data:image/png;base64," + base64Data + "'</image>";
    console.log("image base64 length: " + base64Data.length)
  }

  // FETCH FROM REMOTE API
  // Expect to get back base64 string
  let generatedBase64 = null;
  try {

    logLine("Fetching to " + SELECTEDMODEL);
    if (SELECTEDMODEL == SEEDREAM) {
      // ByteDance SeeDream image generation
      generatedBase64 = await fetchToBytedance(
        prompt,
        base64Data,
      );
    } else if (SELECTEDMODEL === NANOBANANA_PRO) {
      // google nano banana pro image generation
      generatedBase64 = await fetchToGoogle(
        prompt,
        base64Data
      )
    } else if (SELECTEDMODEL === "localtest") {
      // generatedBase64 = base64Data; // for local testing
      // return the original

      const sleep = ms => new Promise(r => setTimeout(r, ms));
      await sleep(1000);
      generatedBase64 = base64Data;

    }
  } catch (error) {
    console.error("Error during remote API call: " + error);
    // document.getElementById("error").style.display = "";
    // document.getElementById("error").innerText = "Error during remote API call:\n" + error.message;
    logLine("Error during remote API call:\n" + error.message);
    return;
  } finally {
    // release generate button
    document.getElementById("generate").disabled = false;
  }

  try {
    console.log("placing generated image to document, length: ", generatedBase64.length);
    logLine("Placing server generated image to document, length: " + generatedBase64.length);
    await placeToCurrentdocAtSelection(generatedBase64, bounds);
    applyMaskWithGaussianBlur(bounds);
  } catch (error) {
    console.error("Error placing generated image to document: " + error);
    logLine("Error placing generated image to document: " + error)
    // document.getElementById("error").innerText = "Error placing generated image to document:\n" + error.message;
    return;
  }

}

// fetch image-to-image from Bytedance server
async function fetchToBytedance(prompt = "", base64Image, model = SEEDREAM) {
  if (prompt.length <= 1) {
    return
  } else {
    // specify the ratio for SeeDream in the prompt wording
    prompt += ", aspect ratio: " + aspectRatio;
  }

  try {
    const res = await fetch("https://ark.cn-beijing.volces.com/api/v3/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey["SeeDream-api-key"]
      },
      body: JSON.stringify({
        model,
        prompt,
        image: `data:image/png;base64,${base64Image}`, // 传入 Base64 图像
        size: resolution,
        watermark: false,
        response_format: "b64_json", // 返回 Base64
        sequential_image_generation: "disabled", // 单图生成
        optimize_prompt_options: {
          mode: "standard" // or "fast"
        }
      })
    });
    if (!res.ok) {
      console.error("ERROR, check original response for mor details:", res);
      logLine("ERROR:", res?.status, res?.statusText);
      throw res.error;
    }
    const data = await res.json();
    console.log("raw data from server", data);
    if (data.error) {
      console.error("API Error:", data.error.message);
      throw new Error(data);
    }
    if (!data.data || !data.data[0] || !data.data[0].b64_json) {
      throw new Error("No image data returned");
    }
    return data.data[0].b64_json;
  } catch (err) {
    throw err;
  }
}

// fetch image-to-image from Google server
async function fetchToGoogle(prompt, base64data = null) {
  if (prompt.length <= 1) {
    return;
  }
  if (!base64data) {
    console.log("No base64 image data provided for generateContent.");
    return;
  }

  const API_KEY = apiKey["NanoBananaPro-api-key"];
  const API_ENDPOINT = "https://aiplatform.googleapis.com";
  const MODEL_ID = NANOBANANA_PRO;
  // const GENERATE_CONTENT_API = "streamGenerateContent";
  const GENERATE_CONTENT_API = "generateContent";
  TEMPERATURE = document.getElementById("temperature").value;
  TOP_P = document.getElementById("top_p").value;

  // Temperature setting
  // 0.3 – 0.6
  // Lower values keep results realistic and consistent. Higher values make the AI more “creative,” which may distort facial features.

  // Top-p setting
  // 0.8 – 0.95
  // Similar to temperature, but instead of focusing on the likelihood of individual words, it considers the cumulative probability of word choices.
  // Lower values make the output more focused and deterministic, while higher values increase diversity.

  // Build the request body
  const requestBody = {
    contents: [
      {
        role: "user",
        parts: []
      }
    ],
    generationConfig: {
      responseModalities: ["IMAGE"],
      temperature: TEMPERATURE ? TEMPERATURE : 0.6,
      maxOutputTokens: 32768,
      topP: TOP_P ? TOP_P : 0.90,
      imageConfig: {
        aspectRatio: aspectRatio,
        imageSize: resolution,
        imageOutputOptions: {
          mimeType: "image/png",
        },
        personGeneration: "ALLOW_ALL"
      },
    },
    safetySettings: [
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" }
    ]
  };


  // Add base64 image if provided
  if (base64data) {
    const inlineData = {
      mimeType: "image/png",
      data: base64data
    }
    requestBody.contents[0].parts.push({ inlineData: inlineData });
  }

  // Add text prompt
  requestBody.contents[0].parts.push({ text: prompt });

  const url = `${API_ENDPOINT}/v1/publishers/google/models/${MODEL_ID}:${GENERATE_CONTENT_API}?key=${API_KEY}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });

    if (response) {

      console.log("raw response from server:", response);
      logLine("Server side completed.")

      if (!response.ok) {
        const errorData = await response.text();
        console.error(`HTTP error! status: ${response.status}`, errorData);
        throw new Error(`API call failed with status ${response.status} ${response.statusText}`);
      }

      let json;
      try {
        logLine("Parsing json from server's response.")
        console.log("Parsing json from server's response.")
        json = await response.json();
        if (json.promptFeedback?.blockReasonMessage) {
          console.log(json.promptFeedback.blockReasonMessage);
          logLine(json.promptFeedback.blockReasonMessage);
          throw new Error("Prompt was blocked: " + json.promptFeedback.blockReasonMessage);
        }

        console.log("parsed response JSON:", json);
        logLine("JSON object finished parsing.")
        if (json.candidates[0].content?.parts) {
          const base64 = await json.candidates[0].content.parts[0].inlineData.data;
          return base64;
        } else if (json.candidates[0]?.finishMessage) {
          console.error(json.candidates[0].finishMessage)
          throw new Error(json.candidates[0].finishMessage);
        }
        throw new Error("Unknow error from " + SELECTEDMODEL + ". Possible server-side updated response format.")
      } catch (error) {
        console.error(response);
        throw new Error(error.message);
      }
    }
  } catch (err) {
    throw err;
  }
}

async function redoSelection(bounds) {
  await core.executeAsModal(async () => {
    try {

      const bufferWhite = new Uint8Array(bounds.width * bounds.height);
      bufferWhite.fill(255);

      const imageDataWhite = await imaging.createImageDataFromBuffer(
        bufferWhite,
        {
          width: bounds.width,
          height: bounds.height,
          components: 1,
          colorSpace: "Grayscale",
          chunky: true
        }
      )

      try {

        await imaging.putSelection({
          replace: true,
          imageData: imageDataWhite,
          targetBounds: bounds,
          commandName: "place selection"
        });

        // perhaps inverse
        // await doc.selection.inverse();

        imageDataWhite.dispose();

      } catch (error) {
        console.error("cannot put selection", error)
      }

    } catch (e) {
      console.error(e);
    }
  });

}

async function applyMaskWithGaussianBlur(bounds, radius = 0.10) {
  if (SKIP_MASK) {
    return
  }
  if (radius >= 1) {
    return;
  }
  await core.executeAsModal(async () => {
    try {

      const doc = app.activeDocument;

      const bufferBlack = new Uint8Array(doc.width * doc.height)
      bufferBlack.fill(0);

      const bufferWhite = new Uint8Array(bounds.width * bounds.height);
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
          width: bounds.width - bounds.width * radius,
          height: bounds.height - bounds.height * radius,
          components: 1,
          colorSpace: "Grayscale",
          chunky: true
        }
      )

      // shift bounds
      bounds.left += bounds.width * radius / 2;
      bounds.top += bounds.height * radius / 2;

      // bounds.right -= bounds.width * radius / 2;
      // shrink effect already applied

      bounds.height = bounds.height * (1 - radius);
      bounds.width = bounds.width * (1 - radius);

      try {
        // documentID?: number;
        // layerID: number;
        // kind?: "user";
        // imageData: PhotoshopImageData;
        // replace?: boolean;
        // targetBounds?: BoundsSize | Bounds;
        // commandName?: string;

        const layer = app.activeDocument.activeLayers[0];
        await imaging.putLayerMask({
          layerID: layer.id,
          imageData: imageDataBlack,
          commandName: "Apply Mask to Generated Image Black"
        });

        // adding white
        await imaging.putLayerMask({
          layerID: layer.id,
          imageData: imageDataWhite,
          targetBounds: bounds,
          replace: false,
          commandName: "Apply Mask to Generated Image White"
        });
        const K = 0.015;
        // 0 - 1000px
        // layer.layerMaskFeather = 1000 * radius * maskFeatherConstant;
        layer.layerMaskFeather = K * bounds.width;

        imageDataBlack.dispose();
        imageDataWhite.dispose();

      } catch (error) {
        console.error("cannot putlayermask", error)
      }

    } catch (e) {
      console.error(e);
    }
  });
}

function test(e) {
  if (e.target.checked) {
    SELECTEDMODEL = "localtest";
  } else {
    SELECTEDMODEL = modelPicker.value;
  }
  updateModel(SELECTEDMODEL);
}

function updateModel(model) {
  if (typeof model === 'undefined') return;

  const el = document.getElementById('googleModel');

  if (model === SEEDREAM) {

    // bytedance specified
    document.getElementById("1K").style.display = "none";
    // upgrade
    document.getElementById("2K").selected = true;
    resolution = "2K";
  } else {
    document.getElementById("1K").style.display = "";
  }

  el.style.display = (model === NANOBANANA_PRO) ? '' : 'none';

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
    result = getCurrentTime() + "" + result;
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
  document.getElementById("log").style.display = e.target.checked ? "" : "none";
  document.getElementById("clearLog").style.display = e.target.checked ? "" : "none";
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
    saveKeysToLocalStorage(apiKey)
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
const menuItems = document.querySelectorAll("sp-action-button[data-page]")

document.getElementById("nav").addEventListener("click", e => {
  const btn = e.target.closest("sp-action-button");
  if (!btn) return;

  pages.forEach(p => {
    p.hidden = p.id !== btn.dataset.page;
  });

  menuItems.forEach(m => {
    m.style.textDecoration = m === e.target ? "underline" : "none";
  })

});

document.getElementById("loadPrompt").addEventListener("click", e => {
  document.getElementById("promptInput").value = `现在你是一个Cosplay图片后期师，你需要按照以下规则进行处理：
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
})

document.getElementById("skipMask").addEventListener("click", e => {
  SKIP_MASK = e.target.checked;
})

// GENERATE BUTTON CLICK EVENT
document.getElementById("generate").addEventListener("click", generate)
document.getElementById("clear").addEventListener("click", () => {
  document.getElementById("imageToProcess").innerHTML = "";
})
document.getElementById("test").addEventListener("click", test);
document.getElementById("lockParam").addEventListener("click", lockParameter);
document.getElementById("clearLog").addEventListener("click", clearLog);
document.getElementById("showLog").addEventListener("click", toggleLog)

document.getElementById("update-api-key").addEventListener("click", updateAPIKey);
document.getElementById("showKey").addEventListener("click", (e) => {
  for (const [inputId, keyName] of Object.entries(keyMap)) {
    const inputField = document.getElementById(inputId);
    inputField.value = e.target.checked ? apiKey[keyName] : "";
  }
})


function saveKeysToLocalStorage() {
  localStorage.setItem("apiKeys", JSON.stringify(apiKey));
}

function loadKeysFromLocalStorage() {
  const raw = localStorage.getItem("apiKeys");
  if (!raw) {
    return {
      "NanoBananaPro-api-key": "",
      "SeeDream-api-key": ""
    }
  };

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
