const supportedModels = ["gemini-3-pro-image-preview"];

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
  const VERTEX_API_ENDPOINT = "https://aiplatform.googleapis.com";
  const AI_STUDIO_API_ENDPOINT = "https://generativelanguage.googleapis.com";
  const useVertexApi = typeof API_KEY === "string" && API_KEY.startsWith("AQ");
  const MODEL_ID = modelId || supportedModels[0];
  const GENERATE_CONTENT_API = "generateContent";
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

  const url = useVertexApi
    ? `${VERTEX_API_ENDPOINT}/v1/publishers/google/models/${MODEL_ID}:${GENERATE_CONTENT_API}?key=${API_KEY}`
    : `${AI_STUDIO_API_ENDPOINT}/v1beta/models/${MODEL_ID}:${GENERATE_CONTENT_API}`;

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

module.exports = {
  supportedModels,
  generateImage
};
