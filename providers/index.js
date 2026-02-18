const bytedance = require("./bytedance");
const google = require("./google");
const xai = require("./xai");

const providerList = [bytedance, google, xai];
const providerMap = {};

providerList.forEach(provider => {
  provider.supportedModels.forEach(modelId => {
    providerMap[modelId] = provider;
  });
});

async function generateWithProvider(modelId, options) {
  const provider = providerMap[modelId];
  if (!provider) {
    throw new Error("Unsupported model: " + modelId);
  }
  return provider.generateImage({ ...options, modelId });
}

function critiqueWithProvider(modelId, options) {
  const provider = providerMap[modelId];
  if (!provider) {
    throw new Error("Unsupported model: " + modelId);
  }
  if (typeof provider.critiqueImageStream !== "function") {
    throw new Error("Critique mode is not supported for model: " + modelId);
  }
  return provider.critiqueImageStream({ ...options, modelId });
}

module.exports = {
  generateWithProvider,
  critiqueWithProvider,
  providerMap
};
