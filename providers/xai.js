const supportedModels = ["grok-imagine-image"];

const API_ENDPOINT = "https://api.x.ai/v1/images";

function normalizeResolution(resolution) {
  if (!resolution) return undefined;
  const normalized = String(resolution).toLowerCase();
  if (normalized === "1k" || normalized === "2k") return normalized;
  if (normalized === "4k") return "2k";
  return undefined;
}

function normalizeAspectRatio(aspectRatio) {
  if (!aspectRatio || aspectRatio === "default" || aspectRatio === "none") {
    return undefined;
  }
  return aspectRatio;
}

function buildImageInput(base64Image) {
  if (!base64Image) return undefined;
  if (typeof base64Image === "string" && /^https?:\/\//i.test(base64Image)) {
  } else {
    base64Image = "data:image/png;base64," + base64Image;
  }
  return { url: base64Image };
}

async function generateImage(options) {
  let { prompt = "" } = options || {}
  const {
    base64Image,
    apiKey,
    resolution,
    aspectRatio,
    modelId,
    textToImage = false,
    logLine,
    nsfw
  } = options || {};

  if (prompt.length <= 1) {
    return;
  }

  if (!nsfw) {
    prompt = "No NSFW content allowed." + prompt;
  }

  if (!textToImage && !base64Image) {
    console.log("No base64 image data provided for edit request.");
    if (typeof logLine === "function") {
      logLine("No base64 image data provided for edit request.");
    }
    return;
  }

  const API_KEY = apiKey["xAI-api-key"];
  const MODEL_ID = modelId || supportedModels[0];
  const endpoint = textToImage ? `${API_ENDPOINT}/generations` : `${API_ENDPOINT}/edits`;

  const requestBody = {
    model: MODEL_ID,
    prompt,
    response_format: "b64_json"
  };

  const normalizedResolution = normalizeResolution(resolution);
  if (normalizedResolution) {
    requestBody.resolution = normalizedResolution;
  }

  if (textToImage) {
    const normalizedAspectRatio = normalizeAspectRatio(aspectRatio);
    if (normalizedAspectRatio) {
      requestBody.aspect_ratio = normalizedAspectRatio;
    }
  } else {
    requestBody.image = buildImageInput(base64Image);
  }

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "accept": "application/json",
        "Authorization": "Bearer " + API_KEY
      },
      body: JSON.stringify(requestBody)
    });

    if (typeof logLine === "function") {
      logLine("Server side completed.");
    }

    if (!res.ok) {
      let errorMessage = `API call failed with status ${res.status} ${res.statusText}`;
      try {
        const errorData = await res.json();
        errorMessage = errorData?.error;
      } catch {
        try {
          const errorText = await res.text();
          if (errorText) {
            errorMessage = errorText;
          }
        } catch {
          // keep default errorMessage
        }
      }
      throw new Error(errorMessage);
    }

    if (typeof logLine === "function") {
      logLine("Parsing json from server's response.");
    }
    const data = await res.json();
    if (typeof logLine === "function") {
      logLine("JSON object finished parsing.");
    }
    if (data.error) {
      throw new Error(data.error.message || data.error);
    }
    const imageData = data?.data?.[0]?.b64_json;
    if (!imageData) {
      throw new Error("No image data returned");
    }
    return imageData;
  } catch (err) {
    throw err;
  }
}

module.exports = {
  supportedModels,
  generateImage
};
