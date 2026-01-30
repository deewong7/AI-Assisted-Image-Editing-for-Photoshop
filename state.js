const SEEDREAM = "doubao-seedream-4-5-251128";
const NANOBANANA_PRO = "gemini-3-pro-image-preview";
const GROK_2_IMAGE = "grok-2-image";

const DEFAULT_API_KEYS = Object.freeze({
  "NanoBananaPro-api-key": "",
  "SeeDream-api-key": ""
});

const DEFAULT_PROMPT_PRESETS = {
  default: `现在你是一个Cosplay图片后期师，你需要按照以下规则进行处理：
\t1.身材调整：对模特的胸部、腰部、臀部等部位进行适度膨胀，让模特的身材更加丰满且自然。
\t2.头发优化：消除头发中所有不和谐的杂乱部分，在原有发型基础上增加3-5缕随微风飘动的头发，使头发材质呈现超写实、精致的CG质感。
\t3.道具材质调整：
\t所有塑料道具赋予金属质感，同时保留原有颜色。
\t所有皮质材质变得更精致、更有质感。
\t4.面部与皮肤美化：
\t对模特进行皮肤和美颜调整，消除双下巴。
\t优化下颌线，使其轮廓清晰。
\t调整肌肤纹理均匀精致，弱化唇纹。
\t根据模特所Cos角色判断原人设的人种特征，并进行对应风格的补妆。
\t5.灯光调整：
\t在现有灯光基础上增加轮廓光和补充光，以更好地展示服装材质、轮廓和人物边缘。
\t让模特面部光线柔和，尽可能减弱面部投影。
\t6.服装与布料优化：
\t移除模特服装上的所有褶皱和污渍，让布料材质崭新柔顺。
\t对裙摆、飘带等容易被风吹动的部位，适当增加飘动效果。`
};

function createState({ ui, apiKey, promptPresets } = {}) {
  const modelValue = ui?.modelPicker?.value ?? NANOBANANA_PRO;
  const resolutionValue = ui?.resolutionPicker?.value ?? "2K";
  const aspectRatioValue = ui?.aspectRatioPicker?.value ?? "default";

  return {
    selectedModel: modelValue,
    resolution: resolutionValue,
    aspectRatio: aspectRatioValue,
    adaptiveResolutionSetting: true,
    upgradeFactor: 1.5,
    showModelParameters: false,
    temperature: 0.6,
    topP: 0.95,
    imageArray: [],
    skipMask: false,
    textToImage: false,
    currentJobCount: 0,
    apiKey: apiKey || { ...DEFAULT_API_KEYS },
    promptPresets: promptPresets || { ...DEFAULT_PROMPT_PRESETS }
  };
}

module.exports = {
  SEEDREAM,
  NANOBANANA_PRO,
  GROK_2_IMAGE,
  DEFAULT_API_KEYS,
  DEFAULT_PROMPT_PRESETS,
  createState
};
