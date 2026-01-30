const supportedModels = ["doubao-seedream-4-5-251128"];

async function generateImage(options) {
  const {
    prompt = "",
    base64Image,
    apiKey,
    resolution,
    aspectRatio,
    referenceImages = [],
    modelId,
    textToImage = false
  } = options || {};

  if (prompt.length <= 1) {
    return;
  }

  let effectivePrompt = prompt;
  if (aspectRatio && aspectRatio !== "default" && aspectRatio !== "none") {
    effectivePrompt += ", aspect ratio: " + aspectRatio;
  }

  let effectiveResolution = resolution;
  if (effectiveResolution === "1K") {
    effectiveResolution = "2K";
  }

  let image;
  if (textToImage) {
    if (referenceImages.length >= 1) {
      image = referenceImages.map(data => `data:image/png;base64,${data}`);
    }
  } else if (referenceImages.length >= 1) {
    const b64Arr = referenceImages.map(data => `data:image/png;base64,${data}`);
    b64Arr.push(`data:image/png;base64,${base64Image}`);
    image = b64Arr;
  } else {
    image = `data:image/png;base64,${base64Image}`;
  }

  try {
    const res = await fetch("https://ark.cn-beijing.volces.com/api/v3/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey["SeeDream-api-key"]
      },
      body: JSON.stringify({
        model: modelId || supportedModels[0],
        prompt: effectivePrompt,
        ...(typeof image !== "undefined" ? { image } : {}),
        size: effectiveResolution,
        watermark: false,
        response_format: "b64_json",
        sequential_image_generation: "disabled",
        optimize_prompt_options: {
          mode: "standard"
        }
      })
    });
    if (!res.ok) {
      const errorData = await res.json();
      console.error("ERROR, check original response for mor details:", errorData);
      throw new Error(errorData?.error?.message);
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

module.exports = {
  supportedModels,
  generateImage
};
