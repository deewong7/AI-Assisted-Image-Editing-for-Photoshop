# AI-Assisted Image Editing for Photoshop
[English](./README.md) | [简体中文](./README.zh-CN.md)

[![Test](https://github.com/deewong7/AI-Assisted-Image-Editing-for-Photoshop/actions/workflows/tests.yml/badge.svg?branch=dev)](https://github.com/deewong7/AI-Assisted-Image-Editing-for-Photoshop/actions/workflows/tests.yml)

把前沿的 image generation 和 image editing 直接带进 Photoshop。这个 UXP plugin 让你在不离开当前文档的情况下，选中区域、输入 prompt，并通过主流图像模型生成1K,2K,4K图片。

## 这个插件能做什么
- 在 Photoshop 内对选区进行生成与编辑
- 支持多个 provider 和 model
- `Nano Banana Pro` 与 `SeeDream 4.5/5.0` 支持 **4K** 输出
- 支持参考图功能
- 支持自适应分辨率，在 quality 与 speed 间做平衡
- 将结果以新图层形式放入当前文档

## 你可能会需要它的原因
- 使用免费额度或 cloud credits，而不是本地 GPU
- Google 提供 **$300** cloud credits
- ByteDance 前 200 次生成免费，之后每天再送 20 次免费
- 工作流保持在 Photoshop 内，不需要在多个 app 之间切换
- 老机器也能流畅使用（如 GTX1080），因为计算在 cloud 端完成
- **No ComfyUI needed**

## 支持的模型
- Google: Nano Banana Pro 3
- ByteDance: SeeDream 4.5, SeeDream 5.0
- xAI: Grok Imagine

## 快速开始
1) 将插件源码解压到 Photoshop 的 `Plug-ins` 目录（**需要重启**）。
2) 打开面板并选择模型。
3) 在当前文档中创建选区。
4) 输入 提示词 并点击 Generate按钮。
5) 完成。

## API keys
你可以只配置一个，也可以同时配置多个：
- Google API key: [Google Vertex AI](https://cloud.google.com/vertex-ai?hl=en)
- Google AI Studio [Google AI Studio](https://aistudio.google.com)
- ByteDance API key: [Volcengine](https://console.volcengine.com/ark/region:ark+cn-beijing/openManagement?LLM=%7B%7D&advancedActiveKey=model&tab=ComputerVision)
- xAI API Key: [xAI](https://console.x.ai/)

## 截图
### 主页面
<!-- ![Main Page](./images/main.jpg) -->
<img src="./images/main.jpg" height="800">

### 偏好设置页
<!-- ![Preference Page](./images/preference.jpg) -->
<img src="./images/preference.jpg" height="800">

## 兼容性
- macOS
- Windows

## 参考资料
- [Photoshop API Documentation](https://developer.adobe.com/photoshop/uxp/2022/ps_reference/)
- [UXP API Documentation](https://developer.adobe.com/photoshop/uxp/2022/uxp-api/)
- [Image Editing Leaderboard](https://artificialanalysis.ai/image/leaderboard/editing/)

## License
GPL-3.0
