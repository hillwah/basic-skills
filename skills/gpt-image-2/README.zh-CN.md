# GPT Image 2 Skill

**面向 GPT Image 2 的聚焦型图像生成 / 编辑技能。一份 SKILL 定义，自动适配三种运行环境——本地直接出图、宿主原生图像工具、纯提示词顾问。**

[English](./README.md) · [返回集合首页](../../README.zh-CN.md)

![GPT Image 2 Skill](https://cdn.jsdelivr.net/gh/ConardLi/assets@main/imgs/gpt-image-2-skill.webp)

---

## 这个 Skill 干什么

围绕 GPT Image 2（以及任何 OpenAI 兼容的图像接口）做的结构化提示词工程 + 图像生成包。只做两件事——`POST /images/generations` 和 `POST /images/edits`。如果配置了独立 `image_env` 第三方网关，会直接请求该网关，不再每次先做模式探测。

它内置了：

- **Direct API 快路径 + 模式感知工作流**：有独立第三方 `image_env` 时直接出图；没有时再判断宿主原生图像工具或纯提示词顾问。
- **结构化模板库**：18 大类、79 个提示词模板，覆盖海报、UI 样机、产品图、信息图、学术图、技术架构图、漫画、头像、编辑工作流。
- **可复用的 prompt + 图片归档**：默认落盘到 `garden-gpt-image-2/prompt/` 和 `garden-gpt-image-2/image/`，按 `<task-slug>-<timestamp>` 命名。

---

## 三种运行模式

优先使用独立配置文件。已配置 `$CODEX_HOME/image_env.json` 或 `~/.codex/image_env.json` 时，直接调用第三方 API；只有没有独立配置或需要诊断时，才运行探测脚本：

```bash
node skills/gpt-image-2/scripts/check-mode.js
# 想拿结构化结果：
node skills/gpt-image-2/scripts/check-mode.js --json
```

输出会判定为以下三种之一：

| 模式 | 触发条件 | 行为 |
|---|---|---|
| **A · 本地 API 生图** | 找到可用于 OpenAI 兼容 Images API 的 API key，且未显式禁用 | 端到端：选模板 → 渲染 prompt → 调用 `generate.js` / `edit.js` → 图片落盘 |
| **B · Host-Native 委托宿主出图** | 未启用 Garden，但宿主 Agent 自带图像工具（`image_generation` / `dalle` / `nano_banana` / 图像 MCP 等） | 渲染好 prompt 后**交给宿主自带的图像工具**出图 |
| **C · Advisor 纯提示词顾问** | 未启用 Garden，宿主也没有图像工具 | 退化成"高质量 prompt 撰写顾问"——把 prompt 落盘到 `garden-gpt-image-2/prompt/`，告诉用户去 ChatGPT / Midjourney / DALL·E / Sora / Nano Banana / 自己的网关里执行 |

三种模式都建议落盘 prompt 文件（A、C 必须，B 推荐），但只有 A 会产出图片文件——B 由宿主决定，C 不可能。

---

## 快速上手

### 0. 初始化或手动配置第三方 API

```bash
node skills/gpt-image-2/scripts/init-image-env.js
```

默认会创建 `$CODEX_HOME/image_env.json`；未设置 `CODEX_HOME` 时，macOS / Linux 是 `~/.codex/image_env.json`，Windows 是 `%USERPROFILE%\.codex\image_env.json`。内容包含 `model_name`、`base_url`、`key`、`http_client`、`user_agent`。填好第三方网关信息后，Claude / Codex / OpenCode 都会直接读同一份配置并请求该 API。

只有排查环境时才需要：

```bash
node skills/gpt-image-2/scripts/check-mode.js
```

下面 1~4 仅在 **Mode A / Direct API** 下使用。Mode A 会优先读取独立 `image_env`；没有独立配置时，只识别显式环境变量，例如 `GPT_IMAGE_API_KEY` / `OPENAI_API_KEY` / `OPENAI_BASE_URL`。不会读取 Codex `config.toml` 或 `auth.json`。

### 1. 文本生图

```bash
node skills/gpt-image-2/scripts/generate.js \
  --prompt "A cute baby sea otter" \
  --size 1024x1024 \
  --quality high
```

### 2. 用提示词文件生图

```bash
node skills/gpt-image-2/scripts/generate.js \
  --promptfile garden-gpt-image-2/prompt/poster-20260424-153045.md
```

### 3. 编辑已有图片

```bash
node skills/gpt-image-2/scripts/edit.js \
  --image assets/source.png \
  --prompt "Replace the background with a clean studio scene"
```

### 4. 带遮罩的局部编辑

```bash
node skills/gpt-image-2/scripts/edit.js \
  --image assets/source.png \
  --mask  assets/mask.png \
  --prompt "Replace only the masked area with a glass vase"
```

Mode B / C 没有 CLI 入口——Skill 只负责把最终 prompt 渲染好，然后交给宿主图像工具（B）或直接呈现给用户（C）。

---

## 案例画廊

公开案例库目前覆盖 18 大类、79 个模板、160+ 个生成 / 编辑结果。这里不是完整索引，而是挑出最能代表能力边界的关键案例：每张缩略图都会跳到线上案例页，图片本身来自独立的 `ConardLi/gpt-image-2-101` 案例仓库。

### UI 样机

<table>
  <tr>
    <td width="50%" align="center"><a href="https://gpt-image2.mmh1.top/#/case/ui-mockups%2Flive-commerce-ui%2F1"><img src="https://cdn.jsdelivr.net/gh/ConardLi/gpt-image-2-101@main/public/case/ui-mockups/live-commerce-ui/1-thumb.webp" alt="直播带货 UI 案例" width="100%"></a><br/><strong><code>live-commerce-ui</code></strong><br/><sub>明星直播带货界面，含商品、弹幕、礼物和状态层。</sub></td>
    <td width="50%" align="center"><a href="https://gpt-image2.mmh1.top/#/case/ui-mockups%2Fsocial-interface-mockup%2F3"><img src="https://cdn.jsdelivr.net/gh/ConardLi/gpt-image-2-101@main/public/case/ui-mockups/social-interface-mockup/3-thumb.webp" alt="社交界面样机案例" width="100%"></a><br/><strong><code>social-interface-mockup</code></strong><br/><sub>科技品牌官方账号发布产品更新公告。</sub></td>
  </tr>
  <tr>
    <td width="50%" align="center"><a href="https://gpt-image2.mmh1.top/#/case/ui-mockups%2Fproduct-card-overlay%2F1"><img src="https://cdn.jsdelivr.net/gh/ConardLi/gpt-image-2-101@main/public/case/ui-mockups/product-card-overlay/1-thumb.webp" alt="产品落地页叠层案例" width="100%"></a><br/><strong><code>product-card-overlay</code></strong><br/><sub>护肤落地页 hero，包含模特、产品和卖点徽章。</sub></td>
    <td width="50%" align="center"><a href="https://gpt-image2.mmh1.top/#/case/ui-mockups%2Fchat-interface-scene%2F3"><img src="https://cdn.jsdelivr.net/gh/ConardLi/gpt-image-2-101@main/public/case/ui-mockups/chat-interface-scene/3-thumb.webp" alt="聊天界面案例" width="100%"></a><br/><strong><code>chat-interface-scene</code></strong><br/><sub>Claude 风格 AI 助手截图，强调对话层级和结构化回答。</sub></td>
  </tr>
</table>

### 产品与品牌

<table>
  <tr>
    <td width="50%" align="center"><a href="https://gpt-image2.mmh1.top/#/case/product-visuals%2Fexploded-view-poster%2F2"><img src="https://cdn.jsdelivr.net/gh/ConardLi/gpt-image-2-101@main/public/case/product-visuals/exploded-view-poster/2-thumb.webp" alt="产品爆炸图案例" width="100%"></a><br/><strong><code>exploded-view-poster</code></strong><br/><sub>Vision Pro 2 光机与算力模块拆解主视觉。</sub></td>
    <td width="50%" align="center"><a href="https://gpt-image2.mmh1.top/#/case/product-visuals%2Fpremium-studio-product%2F1"><img src="https://cdn.jsdelivr.net/gh/ConardLi/gpt-image-2-101@main/public/case/product-visuals/premium-studio-product/1-thumb.webp" alt="高端影棚产品图案例" width="100%"></a><br/><strong><code>premium-studio-product</code></strong><br/><sub>高端护肤静物，适合官网 hero 和杂志跨页。</sub></td>
  </tr>
  <tr>
    <td width="50%" align="center"><a href="https://gpt-image2.mmh1.top/#/case/branding-and-packaging%2Fcosmetic-packaging%2F1"><img src="https://cdn.jsdelivr.net/gh/ConardLi/gpt-image-2-101@main/public/case/branding-and-packaging/cosmetic-packaging/1-thumb.webp" alt="化妆品包装案例" width="100%"></a><br/><strong><code>cosmetic-packaging</code></strong><br/><sub>国货高端护肤礼盒，兼顾材质和品牌感。</sub></td>
    <td width="50%" align="center"><a href="https://gpt-image2.mmh1.top/#/case/branding-and-packaging%2Fbeverage-label-design%2F1"><img src="https://cdn.jsdelivr.net/gh/ConardLi/gpt-image-2-101@main/public/case/branding-and-packaging/beverage-label-design/1-thumb.webp" alt="饮料标签设计案例" width="100%"></a><br/><strong><code>beverage-label-design</code></strong><br/><sub>国潮气泡水酒标 / 瓶标与商拍场景。</sub></td>
  </tr>
</table>

### 图像编辑工作流

<table>
  <tr>
    <td width="50%" align="center"><a href="https://gpt-image2.mmh1.top/#/case/editing-workflows%2Fbackground-replacement%2F1"><img src="https://cdn.jsdelivr.net/gh/ConardLi/gpt-image-2-101@main/public/case/editing-workflows/background-replacement/1-thumb.webp" alt="背景替换案例" width="100%"></a><br/><strong><code>background-replacement</code></strong><br/><sub>把日间人像替换到时代广场夜景并重新布光。</sub></td>
    <td width="50%" align="center"><a href="https://gpt-image2.mmh1.top/#/case/editing-workflows%2Fobject-removal%2F1"><img src="https://cdn.jsdelivr.net/gh/ConardLi/gpt-image-2-101@main/public/case/editing-workflows/object-removal/1-thumb.webp" alt="杂物去除案例" width="100%"></a><br/><strong><code>object-removal</code></strong><br/><sub>毕业合影去除边缘误入人物并修补背景。</sub></td>
  </tr>
  <tr>
    <td width="50%" align="center"><a href="https://gpt-image2.mmh1.top/#/case/editing-workflows%2Fproduct-retouching%2F1"><img src="https://cdn.jsdelivr.net/gh/ConardLi/gpt-image-2-101@main/public/case/editing-workflows/product-retouching/1-thumb.webp" alt="产品精修案例" width="100%"></a><br/><strong><code>product-retouching</code></strong><br/><sub>AirPods 电商主图质感、边缘与标签锐化。</sub></td>
    <td width="50%" align="center"><a href="https://gpt-image2.mmh1.top/#/case/editing-workflows%2Fportrait-local-edit%2F1"><img src="https://cdn.jsdelivr.net/gh/ConardLi/gpt-image-2-101@main/public/case/editing-workflows/portrait-local-edit/1-thumb.webp" alt="人像局部编辑案例" width="100%"></a><br/><strong><code>portrait-local-edit</code></strong><br/><sub>在保留身份的前提下调整发色与发型。</sub></td>
  </tr>
</table>

### 信息图与视觉文档

<table>
  <tr>
    <td width="50%" align="center"><a href="https://gpt-image2.mmh1.top/#/case/infographics%2Fbento-grid-infographic%2F1"><img src="https://cdn.jsdelivr.net/gh/ConardLi/gpt-image-2-101@main/public/case/infographics/bento-grid-infographic/1-thumb.webp" alt="便当格信息图案例" width="100%"></a><br/><strong><code>bento-grid-infographic</code></strong><br/><sub>iPhone 16 Pro 功能拆解，以便当格组织高密度信息。</sub></td>
    <td width="50%" align="center"><a href="https://gpt-image2.mmh1.top/#/case/infographics%2Fcomparison-infographic%2F1"><img src="https://cdn.jsdelivr.net/gh/ConardLi/gpt-image-2-101@main/public/case/infographics/comparison-infographic/1-thumb.webp" alt="对比信息图案例" width="100%"></a><br/><strong><code>comparison-infographic</code></strong><br/><sub>手机选购对比图，围绕决策维度组织信息。</sub></td>
  </tr>
  <tr>
    <td width="50%" align="center"><a href="https://gpt-image2.mmh1.top/#/case/slides-and-visual-docs%2Fdense-explainer-slides%2F2"><img src="https://cdn.jsdelivr.net/gh/ConardLi/gpt-image-2-101@main/public/case/slides-and-visual-docs/dense-explainer-slides/2-thumb.webp" alt="高密度讲解单页案例" width="100%"></a><br/><strong><code>dense-explainer-slides</code></strong><br/><sub>AI Agent 工作机制一页讲清，适合技术培训。</sub></td>
    <td width="50%" align="center"><a href="https://gpt-image2.mmh1.top/#/case/slides-and-visual-docs%2Fvisual-report-page%2F1"><img src="https://cdn.jsdelivr.net/gh/ConardLi/gpt-image-2-101@main/public/case/slides-and-visual-docs/visual-report-page/1-thumb.webp" alt="视觉报告页案例" width="100%"></a><br/><strong><code>visual-report-page</code></strong><br/><sub>商业执行摘要页，结合 KPI 卡片与趋势图节奏。</sub></td>
  </tr>
</table>

### 学术与技术图

<table>
  <tr>
    <td width="50%" align="center"><a href="https://gpt-image2.mmh1.top/#/case/academic-figures%2Fmethod-pipeline-overview%2F1"><img src="https://cdn.jsdelivr.net/gh/ConardLi/gpt-image-2-101@main/public/case/academic-figures/method-pipeline-overview/1-thumb.webp" alt="方法流程图案例" width="100%"></a><br/><strong><code>method-pipeline-overview</code></strong><br/><sub>RAG 长上下文问答方法流程，适合论文 overview。</sub></td>
    <td width="50%" align="center"><a href="https://gpt-image2.mmh1.top/#/case/academic-figures%2Fneural-network-architecture%2F2"><img src="https://cdn.jsdelivr.net/gh/ConardLi/gpt-image-2-101@main/public/case/academic-figures/neural-network-architecture/2-thumb.webp" alt="神经网络架构图案例" width="100%"></a><br/><strong><code>neural-network-architecture</code></strong><br/><sub>ViT-B/16 架构图，包含 Patch Embedding 与张量流向。</sub></td>
  </tr>
  <tr>
    <td width="50%" align="center"><a href="https://gpt-image2.mmh1.top/#/case/technical-diagrams%2Fsystem-architecture%2F1"><img src="https://cdn.jsdelivr.net/gh/ConardLi/gpt-image-2-101@main/public/case/technical-diagrams/system-architecture/1-thumb.webp" alt="系统架构图案例" width="100%"></a><br/><strong><code>system-architecture</code></strong><br/><sub>多租户 AI 客服 SaaS 生产架构总览。</sub></td>
    <td width="50%" align="center"><a href="https://gpt-image2.mmh1.top/#/case/technical-diagrams%2Fsequence-diagram%2F1"><img src="https://cdn.jsdelivr.net/gh/ConardLi/gpt-image-2-101@main/public/case/technical-diagrams/sequence-diagram/1-thumb.webp" alt="时序图案例" width="100%"></a><br/><strong><code>sequence-diagram</code></strong><br/><sub>OAuth 2.0 授权码 + PKCE 标准时序。</sub></td>
  </tr>
</table>

### 故事、地图与角色

<table>
  <tr>
    <td width="50%" align="center"><a href="https://gpt-image2.mmh1.top/#/case/storyboards-and-sequences%2Fanime-key-visual%2F1"><img src="https://cdn.jsdelivr.net/gh/ConardLi/gpt-image-2-101@main/public/case/storyboards-and-sequences/anime-key-visual/1-thumb.webp" alt="动漫主视觉案例" width="100%"></a><br/><strong><code>anime-key-visual</code></strong><br/><sub>东方幻想游戏首发 KV，兼顾多比例裁切。</sub></td>
    <td width="50%" align="center"><a href="https://gpt-image2.mmh1.top/#/case/maps%2Ffood-map%2F1"><img src="https://cdn.jsdelivr.net/gh/ConardLi/gpt-image-2-101@main/public/case/maps/food-map/1-thumb.webp" alt="美食地图案例" width="100%"></a><br/><strong><code>food-map</code></strong><br/><sub>上海武康路 City Walk 美食地图，带插画地标。</sub></td>
  </tr>
  <tr>
    <td width="50%" align="center"><a href="https://gpt-image2.mmh1.top/#/case/maps%2Ftravel-route-map%2F1"><img src="https://cdn.jsdelivr.net/gh/ConardLi/gpt-image-2-101@main/public/case/maps/travel-route-map/1-thumb.webp" alt="旅行路线图案例" width="100%"></a><br/><strong><code>travel-route-map</code></strong><br/><sub>京都三日慢走路线图，带站点插画与路线节奏。</sub></td>
    <td width="50%" align="center"><a href="https://gpt-image2.mmh1.top/#/case/portraits-and-characters%2Fprofessional-portrait%2F1"><img src="https://cdn.jsdelivr.net/gh/ConardLi/gpt-image-2-101@main/public/case/portraits-and-characters/professional-portrait/1-thumb.webp" alt="职业肖像案例" width="100%"></a><br/><strong><code>professional-portrait</code></strong><br/><sub>克制的企业领袖肖像，适合官网 About 与媒体页。</sub></td>
  </tr>
</table>

<sub>完整案例库：<a href="https://gpt-image2.mmh1.top/#/case"><b>线上案例浏览器</b></a> · <a href="https://github.com/ConardLi/gpt-image-2-101/tree/main/public/case">案例资源仓库</a> · 本地索引 <code>website/gpt-image2-website/public/case/INDEX.md</code>。</sub>

---

## Skill 结构

```
skills/gpt-image-2/
├── SKILL.md                       主技能定义
├── scripts/
│   ├── check-mode.js              模式 A/B/C 探测器（仅诊断或没有独立配置时运行）
│   ├── init-image-env.js          创建 image_env.json/yaml 配置模板
│   ├── generate.js                文本生图（仅 Mode A）
│   ├── edit.js                    图像编辑 / 局部编辑（仅 Mode A）
│   ├── auth-resolver.js           显式 API key / base URL 解析；不会读取 Codex config/auth
│   ├── shared.js                  共享请求 / 落盘 / 环境变量解析
│   └── package.json
└── references/
    ├── prompt-writing.md          方法论：模板怎么设计、缺字段怎么问
    ├── ui-mockups/                直播带货、社交、产品卡、聊天、短视频封面
    ├── product-visuals/           爆炸图、纯白底、影棚、包装、生活方式
    ├── infographics/              信息图
    ├── poster-and-campaigns/      品牌主海报、Campaign KV、banner、杂志封面
    ├── slides-and-visual-docs/    高密度讲解、政策风、商业报告、教学示意
    ├── portraits-and-characters/  职业肖像、创始人肖像、虚拟主播、角色设定
    ├── scenes-and-illustrations/  治愈系、概念大场景、绘本、极简留白
    ├── editing-workflows/         背景替换、局部替换、去除、产品精修、人像编辑
    ├── avatars-and-profile/       风格化自拍、角色网格、3D 图标、贴纸、文化系列
    ├── storyboards-and-sequences/ 4 格漫画、漫画分镜、动漫 KV、角色关系图、流程图
    ├── grids-and-collages/        2×2 banner、lookbook、混风格拼贴、动漫 pitch board
    ├── branding-and-packaging/    品牌识别系统、吉祥物、化妆品包装、饮料标签
    ├── typography-and-text-layout/ 大字海报、双语版式
    ├── assets-and-props/          拟物图标、游戏截图样机
    ├── academic-figures/          方法 pipeline、神经网络架构、定性对比
    ├── technical-diagrams/        架构图、流程图、时序图
    └── maps/                      美食地图、旅行路线图、城市插画、门店分布
```

---

## 环境变量

按以下顺序读取：CLI 参数 → `process.env` → `<cwd>/.env` → `<cwd>/.gateway.env` → `~/.gateway.env`。

| 变量 | 必需性 | 说明 |
|---|---|---|
| `ENABLE_GARDEN_IMAGEGEN` | 可选 | 真值会强制探测 Mode A；假值会显式禁用本地 API 生图 |
| `OPENAI_API_KEY` | Mode A | 真正调图像 API 用的首选 key |
| `OPENAI_BASE_URL` | 可选 | 默认 `https://api.openai.com/v1`，可指向任意 OpenAI 兼容网关；若不是以 `/v1` 结尾会自动补上 |
| `OPENAI_IMAGE_MODEL` | 可选 | 默认 `gpt-image-2`，也可换成 `gpt-image-1` / `dall-e-3` 等 |
| `OPENAI_IMAGE_AUTO_APPEND_V1` | 可选 | 默认开启；设为 `0` / `false` / `no` / `off` 可关闭自动追加 `/v1` |
| `CODEX_HOME` | 可选 | Codex 配置目录；默认是用户主目录下的 `.codex`，兼容 macOS / Linux / Windows |
| `GPT_IMAGE_CONFIG` / `GPT_IMAGE_2_CONFIG` | 可选 | 显式指定 `image_env.json` 或 `image_env.yaml` 路径 |
| `GPT_IMAGE_BASE_URL` / `GPT_IMAGE_MODEL` / `GPT_IMAGE_API_KEY` | 可选 | 跨 Claude / Codex / OpenCode 的图片 API 环境变量 |
| `GPT_IMAGE_HTTP_CLIENT` | 可选 | `fetch` / `curl` / `auto`；默认 `fetch`。如果中转网关下 Node fetch 502 但 curl 成功，设为 `auto` 或 `curl` |
| `GPT_IMAGE_USER_AGENT` | 可选 | API 请求的 User-Agent，默认 `codex` |

默认实现严格按 OpenAI 兼容接口工作，**不绑定**任何第三方网关。

解析器只读取 CLI 参数、环境变量、`.env` / `.gateway.env`、以及独立 `image_env.json/yaml`。它不会读取 Codex `config.toml` / `auth.json`，也不会尝试使用 Codex 登录缓存连接图片 API。

如果不想运行初始化命令，也可以直接在 Codex 配置目录创建 `image_env.json`。默认路径：macOS / Linux 为 `~/.codex/image_env.json`，Windows 为 `%USERPROFILE%\.codex\image_env.json`。如果设置了 `CODEX_HOME`，则读取 `$CODEX_HOME/image_env.json`。

独立配置文件示例：

```json
{
  "model_name": "gpt-image-2",
  "base_url": "https://api.example.com",
  "key": "sk-...",
  "http_client": "fetch",
  "user_agent": "codex"
}
```

也可以不用明文 key：

```yaml
model_name: gpt-image-2
base_url: https://api.example.com
key_env: CUSTOM_IMAGE_API_KEY
http_client: fetch
user_agent: codex
```

一旦加载到 `image_env`，它就是图片 API 的权威配置和 Direct API 快路径；脚本不会读取 Codex provider / config / auth 缓存做模式判断或连接尝试。如果 `key` 为空且 `key_env` 没有可用环境变量，脚本会提示先配置 key，不会回退到 Codex / Claude / OpenCode 的登录缓存。

### sub2api / nginx 中转排查

如果 `curl` 能通，但 skill 内请求偶发 `502`，通常不是 key 读取问题，而是网关链路差异：

- 默认保留 `http_client: "fetch"`，避免每次尝试多条请求链路。只有确认 Node fetch 经中转 502 而同参数 curl 成功时，再把 `image_env.json` 里的 `http_client` 设为 `auto` 或 `curl`。
- 确认 sub2api 支持 `POST /v1/images/generations` 和 `POST /v1/images/edits`，而不是只转发 chat / responses 端点。
- 确认模型映射里允许 `gpt-image-2`，或把 `model_name` 改成 sub2api 实际支持的模型名。
- nginx 建议为图片接口放宽超时和体积限制：

```nginx
location /v1/ {
    proxy_pass http://sub2api_upstream;
    proxy_http_version 1.1;

    proxy_connect_timeout 75s;
    proxy_send_timeout 300s;
    proxy_read_timeout 300s;
    send_timeout 300s;

    client_max_body_size 100m;
    proxy_request_buffering off;
    proxy_buffering off;
}
```

文本生图请求体不大，但图片编辑会走 multipart 上传，`client_max_body_size` 太小会失败；长时间生成时 `proxy_read_timeout` 太短容易表现为 502 / 504。

如不想把 key 写入 `image_env`，可以在 shell 或 `.gateway.env` 中设置：

```bash
CUSTOM_IMAGE_API_KEY=sk-...
```

---

## 输出约定

如果用户没有明确指定输出路径：

| 内容 | 落盘位置 | 适用模式 |
|---|---|---|
| 渲染好的 prompt | `garden-gpt-image-2/prompt/<task-slug>-<timestamp>.md` | A / B / C |
| 生成的图片 | `garden-gpt-image-2/image/<task-slug>-<timestamp>.png` | 仅 A（B 由宿主决定，C 不产出） |

`<task-slug>` 由用户请求自动派生，`<timestamp>` 是 `YYYYMMDD-HHMMSS`。

示例：

- `garden-gpt-image-2/prompt/live-commerce-ui-20260424-153045.md`
- `garden-gpt-image-2/image/vr-headset-exploded-view-20260424-153102.png`

---

## 设计原则

1. **独立配置优先。** 有 `image_env` 时直接请求第三方 API；没有时才判模式并降级到 B / C。
2. **模板优于自由提示。** 18 大类预校验过的结构化模板，带显式 `{argument ...}` 参数槽和 `default` 标记，质量远高于"你说说想要啥"。
3. **精确提问，不要笼统提问。** 模板字段缺失时按字段精确问（"主播是谁？真人照片 / 名人名字 / 自由描述 / 随机生成？"），不要笼统问"想要什么风格"。
4. **永远归档 prompt。** 即使在顾问模式，渲染好的 prompt 也会落盘，方便复用。
5. **默认 OpenAI 兼容。** 不锁定任何特定网关。

---

## 许可证

MIT
