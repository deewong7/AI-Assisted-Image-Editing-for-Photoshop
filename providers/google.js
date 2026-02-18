const supportedModels = ["gemini-3-pro-image-preview"];
const VERTEX_API_ENDPOINT = "https://aiplatform.googleapis.com";
const AI_STUDIO_API_ENDPOINT = "https://generativelanguage.googleapis.com";

function getApiConfig(apiKey, modelId, apiName) {
  const API_KEY = apiKey["NanoBananaPro-api-key"];
  const MODEL_ID = modelId || supportedModels[0];
  const useVertexApi = typeof API_KEY === "string" && API_KEY.startsWith("AQ");

  const url = useVertexApi
    ? `${VERTEX_API_ENDPOINT}/v1/publishers/google/models/${MODEL_ID}:${apiName}?key=${API_KEY}`
    : `${AI_STUDIO_API_ENDPOINT}/v1beta/models/${MODEL_ID}:${apiName}`;

  return {
    API_KEY,
    MODEL_ID,
    useVertexApi,
    url
  };
}

function extractTextFromPayload(payload, modelId) {
  if (payload?.promptFeedback?.blockReasonMessage) {
    throw new Error("Prompt was blocked: " + payload.promptFeedback.blockReasonMessage);
  }
  const parts = payload?.candidates?.flatMap(candidate => candidate?.content?.parts || []);
  const textParts = parts
    .map(part => part?.text)
    .filter(text => typeof text === "string" && text.length > 0);

  if (textParts.length > 0) {
    return textParts;
  }

  const finishMessage = payload?.candidates?.[0]?.finishMessage;
  if (finishMessage) {
    throw new Error(finishMessage);
  }

  if (typeof payload?.text === "string" && payload.text.length > 0) {
    return [payload.text];
  }

  if (typeof payload === "string" && payload.length > 0) {
    return [payload];
  }

  if (payload?.error?.message) {
    throw new Error(payload.error.message);
  }

  if (typeof payload?.error === "string") {
    throw new Error(payload.error);
  }

  return [];
}

function parseSseEventData(eventText) {
  const lines = eventText.split(/\r?\n/);
  const dataLines = [];
  for (const line of lines) {
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }
  return dataLines.join("\n");
}

function createTextDecoder() {
  if (typeof TextDecoder === "function") {
    return new TextDecoder();
  }
  try {
    const { TextDecoder: UtilTextDecoder } = require("util");
    if (typeof UtilTextDecoder === "function") {
      return new UtilTextDecoder();
    }
  } catch {
    // ignore and fallback to internal UTF-8 decoder
  }

  let pendingBytes = [];
  function decodeUtf8Chunk(bytes, flush = false) {
    const input = pendingBytes.concat(Array.from(bytes || []));
    pendingBytes = [];
    let output = "";
    let index = 0;

    while (index < input.length) {
      const first = input[index];
      let length = 0;
      let codePoint = 0;

      if (first <= 0x7f) {
        length = 1;
        codePoint = first;
      } else if ((first & 0xe0) === 0xc0) {
        length = 2;
        codePoint = first & 0x1f;
      } else if ((first & 0xf0) === 0xe0) {
        length = 3;
        codePoint = first & 0x0f;
      } else if ((first & 0xf8) === 0xf0) {
        length = 4;
        codePoint = first & 0x07;
      } else {
        output += "\uFFFD";
        index += 1;
        continue;
      }

      if (index + length > input.length) {
        if (!flush) {
          pendingBytes = input.slice(index);
          break;
        }
        output += "\uFFFD";
        break;
      }

      let valid = true;
      for (let i = 1; i < length; i++) {
        const next = input[index + i];
        if ((next & 0xc0) !== 0x80) {
          valid = false;
          break;
        }
        codePoint = (codePoint << 6) | (next & 0x3f);
      }

      if (!valid ||
        (length === 2 && codePoint < 0x80) ||
        (length === 3 && codePoint < 0x800) ||
        (length === 4 && codePoint < 0x10000) ||
        codePoint > 0x10ffff ||
        (codePoint >= 0xd800 && codePoint <= 0xdfff)) {
        output += "\uFFFD";
        index += 1;
        continue;
      }

      if (codePoint <= 0xffff) {
        output += String.fromCharCode(codePoint);
      } else {
        const adjusted = codePoint - 0x10000;
        output += String.fromCharCode(
          0xd800 + (adjusted >> 10),
          0xdc00 + (adjusted & 0x3ff)
        );
      }
      index += length;
    }

    if (flush && pendingBytes.length > 0) {
      output += "\uFFFD";
      pendingBytes = [];
    }

    return output;
  }

  return {
    decode(value, options = {}) {
      const bytes = value instanceof Uint8Array ? value : new Uint8Array(value || 0);
      const flush = !options.stream;
      return decodeUtf8Chunk(bytes, flush);
    }
  };
}

async function generateImage(options) {
  const {
    prompt = "",
    base64Image,
    apiKey,
    resolution,
    aspectRatio,
    referenceImages = [],
    temperature,
    topP,
    modelId,
    logLine,
    textToImage = false
  } = options || {};

  if (prompt.length <= 1) {
    return;
  }
  if (!base64Image && !textToImage) {
    console.log("No base64 image data provided for generateContent.");
    return;
  }

  const API_KEY = apiKey["NanoBananaPro-api-key"];
  const MODEL_ID = modelId || supportedModels[0];
  const GENERATE_CONTENT_API = "generateContent";
  const { useVertexApi, url } = getApiConfig(apiKey, MODEL_ID, GENERATE_CONTENT_API);
  const safeTemperature = Number.isFinite(temperature) ? temperature : 1.0;
  const safeTopP = Number.isFinite(topP) ? topP : 0.90;

  const imageConfig = {};
  if (resolution) {
    imageConfig.imageSize = resolution;
  }
  if (useVertexApi) {
    imageConfig.imageOutputOptions = {
      mimeType: "image/png",
    };
    imageConfig.personGeneration = "ALLOW_ALL";
  }

  if (aspectRatio && aspectRatio !== "default" && aspectRatio !== "none") {
    imageConfig.aspectRatio = aspectRatio;
  }

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: []
      }
    ],
    generationConfig: {
      responseModalities: ["IMAGE"],
      temperature: safeTemperature,
      maxOutputTokens: 32768,
      topP: safeTopP,
      imageConfig
    },
    safetySettings: [
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" }
    ]
  };

  if (!textToImage) {
    if (referenceImages.length >= 1) {
      referenceImages.forEach(base64 => {
        requestBody.contents[0].parts.push({
          inlineData: {
            mimeType: "image/png",
            data: base64
          }
        });
      });
    }

    const inlineData = {
      mimeType: "image/png",
      data: base64Image
    };
    requestBody.contents[0].parts.push({ inlineData });
  }

  requestBody.contents[0].parts.push({ text: prompt });

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(useVertexApi ? {} : { "x-goog-api-key": API_KEY })
      },
      body: JSON.stringify(requestBody)
    });

    console.log("raw response from server:", response);
    if (typeof logLine === "function") {
      logLine("Server side completed.");
    }

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`HTTP error! status: ${response.status}`, errorData);
      throw new Error(`API call failed with status ${response.status} ${response.statusText}`);
    }

    let json;
    try {
      if (typeof logLine === "function") {
        logLine("Parsing json from server's response.");
      }
      console.log("Parsing json from server's response.");
      json = await response.json();
      if (json.promptFeedback?.blockReasonMessage) {
        console.log(json.promptFeedback.blockReasonMessage);
        if (typeof logLine === "function") {
          logLine(json.promptFeedback.blockReasonMessage);
        }
        throw new Error("Prompt was blocked: " + json.promptFeedback.blockReasonMessage);
      }

      console.log("parsed response JSON:", json);
      if (typeof logLine === "function") {
        logLine("JSON object finished parsing.");
      }
      const candidate = json.candidates?.[0];
      const imagePart = candidate?.content?.parts?.find(part => part?.inlineData?.data);
      const responseData = imagePart?.inlineData;
      if (responseData?.data) {
        return responseData.data;
      }
      if (candidate?.finishMessage) {
        console.error(candidate.finishMessage);
        throw new Error(candidate.finishMessage);
      }
      throw new Error("Unknown error from " + MODEL_ID + ". Possible server-side updated response format.");
    } catch (error) {
      console.error(response);
      throw new Error(error.message);
    }
  } catch (err) {
    throw err;
  }
}

async function* critiqueImageStream(options) {
  const {
    prompt = "",
    base64Image,
    apiKey,
    modelId,
    logLine
  } = options || {};

  if (prompt.length <= 1) {
    return;
  }
  if (!base64Image) {
    throw new Error("No base64 image data provided for critique.");
  }

  const MODEL_ID = modelId || supportedModels[0];
  const { API_KEY, useVertexApi, url } = getApiConfig(apiKey, MODEL_ID, "streamGenerateContent");
  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: "image/png",
              data: base64Image
            }
          },
          { text: prompt }
        ]
      }
    ],
    generationConfig: {
      responseModalities: ["TEXT"],
      maxOutputTokens: 32768
    },
    safetySettings: [
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" }
    ]
  };

  const streamUrl = `${url}${url.includes("?") ? "&" : "?"}alt=sse`;
  const res = await fetch(streamUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(useVertexApi ? {} : { "x-goog-api-key": API_KEY })
    },
    body: JSON.stringify(requestBody)
  });

  if (typeof logLine === "function") {
    logLine("Server side streaming started.");
  }

  if (!res.ok) {
    const errorData = await res.text();
    console.error(`HTTP error! status: ${res.status}`, errorData);
    throw new Error(`API call failed with status ${res.status} ${res.statusText}`);
  }

  let emittedText = "";
  function* parseEvent(eventText) {
    const rawData = parseSseEventData(eventText);
    if (!rawData || rawData === "[DONE]") {
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(rawData);
    } catch {
      parsed = rawData;
    }

    const texts = extractTextFromPayload(parsed, MODEL_ID);
    for (const text of texts) {
      let delta = text;
      if (text.startsWith(emittedText)) {
        delta = text.slice(emittedText.length);
        emittedText = text;
      } else {
        emittedText += text;
      }
      if (delta.length > 0) {
        yield delta;
      }
    }
  }

  const decoder = createTextDecoder();
  if (!res.body || typeof res.body.getReader !== "function" || !decoder) {
    const textBody = await res.text();
    const blocks = textBody.split(/\r?\n\r?\n/);
    for (const block of blocks) {
      yield* parseEvent(block);
    }
    return;
  }

  const reader = res.body.getReader();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split(/\r?\n\r?\n/);
    buffer = chunks.pop() || "";
    for (const chunk of chunks) {
      yield* parseEvent(chunk);
    }
  }

  buffer += decoder.decode();
  if (buffer.trim().length > 0) {
    yield* parseEvent(buffer);
  }

  if (typeof logLine === "function") {
    logLine("Server side streaming completed.");
  }
}

module.exports = {
  supportedModels,
  generateImage,
  critiqueImageStream
};
