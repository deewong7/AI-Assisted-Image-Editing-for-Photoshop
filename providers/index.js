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

module.exports = {
  generateWithProvider,
  providerMap
};
