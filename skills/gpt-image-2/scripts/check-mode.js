#!/usr/bin/env node
import process from "node:process";
import { loadAmbientEnv, DEFAULT_MODEL, resolveRequestAuth } from "./shared.js";

await loadAmbientEnv();

const TRUTHY = new Set(["1", "true", "yes", "on", "y"]);

const rawFlag = String(process.env.ENABLE_GARDEN_IMAGEGEN || "").trim().toLowerCase();
const hasModeFlag = rawFlag !== "";
const gardenEnabled = TRUTHY.has(rawFlag);
const gardenExplicitlyDisabled = hasModeFlag && !gardenEnabled;

const auth = await resolveRequestAuth({ defaultModel: DEFAULT_MODEL });
const apiKey = auth.apiKey || "";
const baseUrl = auth.baseUrl;
const model = auth.model;

let recommendation;
let mode;
let summary;

if (!gardenExplicitlyDisabled && apiKey) {
  mode = "A";
  recommendation = gardenEnabled ? "garden" : "codex-or-env-api";
  summary =
    "MODE A · 本地 API 生图：用 scripts/generate.js / scripts/edit.js 直接请求 GPT Image 2 兼容接口并落盘。";
} else if (gardenEnabled && !apiKey) {
  mode = "A?";
  recommendation = "garden-missing-key";
  summary =
    "ENABLE_GARDEN_IMAGEGEN 已开，但没有找到可用于 Images API 的 Platform API key。先配置 OPENAI_API_KEY / Codex provider env_key / Codex API-key 登录，或临时降级到 MODE B / C。";
} else {
  mode = "B-or-C";
  recommendation = "host-or-advisor";
  summary =
    "MODE B / C · 未启用 Garden。若宿主 Agent 自带图像工具（image_generation / dalle / mcp__*image* 等）→ MODE B：把 prompt 交给宿主出图。若宿主无图像工具 → MODE C：仅产出高质量 prompt 给用户。";
}

const result = {
  mode,
  recommendation,
  garden_mode_enabled: gardenEnabled,
  garden_explicitly_disabled: gardenExplicitlyDisabled,
  has_api_key: Boolean(apiKey),
  base_url: baseUrl,
  model,
  provider_id: auth.providerId,
  api_key_source: auth.apiKeySource || null,
  base_url_source: auth.baseUrlSource,
  model_source: auth.modelSource,
  diagnostics: auth.diagnostics,
  env_flag_value: rawFlag || "(unset)",
  summary,
};

const wantJson = process.argv.includes("--json");

if (wantJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  const pad = (s) => s.padEnd(24, " ");
  console.log("--- gpt-image-2 runtime mode ---");
  console.log(`${pad("mode")}: ${result.mode}`);
  console.log(`${pad("recommendation")}: ${result.recommendation}`);
  console.log(`${pad("garden_mode_enabled")}: ${result.garden_mode_enabled}`);
  console.log(`${pad("garden_disabled")}: ${result.garden_explicitly_disabled}`);
  console.log(`${pad("has_api_key")}: ${result.has_api_key}`);
  console.log(`${pad("base_url")}: ${result.base_url}`);
  console.log(`${pad("model")}: ${result.model}`);
  console.log(`${pad("provider_id")}: ${result.provider_id}`);
  console.log(`${pad("api_key_source")}: ${result.api_key_source || "(none)"}`);
  console.log(`${pad("base_url_source")}: ${result.base_url_source}`);
  console.log(`${pad("env_flag_value")}: ${result.env_flag_value}`);
  console.log("");
  console.log(result.summary);
}
