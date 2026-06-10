import path from "node:path";
import process from "node:process";
import { homedir } from "node:os";
import { readFile } from "node:fs/promises";

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const CONFIG_BASENAME = "image_env";
const FALSEY = new Set(["0", "false", "no", "off", "n"]);

function stripComment(line) {
  let quote = null;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const prev = line[index - 1];
    if ((char === '"' || char === "'") && prev !== "\\") {
      quote = quote === char ? null : quote || char;
      continue;
    }
    if (char === "#" && !quote) return line.slice(0, index);
  }
  return line;
}

function parseFlatYaml(text) {
  const result = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = stripComment(rawLine).trim();
    if (!line) continue;
    const pivot = line.indexOf(":");
    if (pivot === -1) continue;
    const key = line.slice(0, pivot).trim();
    let value = line.slice(pivot + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key) result[key] = value;
  }
  return result;
}

async function readImageEnvFile(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    if (filePath.endsWith(".json")) return JSON.parse(text);
    if (filePath.endsWith(".yaml") || filePath.endsWith(".yml")) return parseFlatYaml(text);
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function defaultCodexHome(home = homedir(), pathModule = path) {
  return pathModule.join(home, ".codex");
}

function codexHome() {
  return process.env.CODEX_HOME || defaultCodexHome();
}

function configHome() {
  return process.env.XDG_CONFIG_HOME || path.join(homedir(), ".config");
}

function imageEnvConfigCandidates(options = {}) {
  const explicit = options.configPath || process.env.GPT_IMAGE_2_CONFIG || process.env.GPT_IMAGE_CONFIG;
  if (explicit) return [path.resolve(explicit)];

  const agentDirs = [
    codexHome(),
    process.env.CLAUDE_CONFIG_DIR,
    process.env.OPENCODE_CONFIG_DIR,
  ].filter(Boolean);

  const dirs = [
    ...agentDirs,
    path.join(process.cwd(), ".gpt-image-2"),
    process.cwd(),
    path.join(configHome(), "gpt-image-2"),
    path.join(homedir(), ".gpt-image-2"),
  ];

  return dirs.flatMap((dir) => [
    path.join(dir, `${CONFIG_BASENAME}.json`),
    path.join(dir, `${CONFIG_BASENAME}.yaml`),
    path.join(dir, `${CONFIG_BASENAME}.yml`),
  ]);
}

export function defaultImageEnvConfigPath() {
  return path.join(codexHome(), `${CONFIG_BASENAME}.json`);
}

export async function loadImageEnvConfig(options = {}) {
  for (const filePath of imageEnvConfigCandidates(options)) {
    const config = await readImageEnvFile(filePath);
    if (config && typeof config === "object") {
      return { config, path: filePath };
    }
  }
  return { config: null, path: null, candidates: imageEnvConfigCandidates(options) };
}

function pickConfigValue(config, keys) {
  if (!config) return null;
  for (const key of keys) {
    const value = config[key];
    if (value !== undefined && value !== null && value !== "") return String(value);
  }
  return null;
}

function shouldAutoAppendV1(options) {
  const raw = String(options.autoAppendV1 ?? process.env.OPENAI_IMAGE_AUTO_APPEND_V1 ?? "1").trim().toLowerCase();
  return !FALSEY.has(raw);
}

function normalizeBaseUrl(value, options = {}) {
  const trimmed = String(value || DEFAULT_BASE_URL).replace(/\/+$/, "");
  if (!shouldAutoAppendV1(options)) return trimmed;
  return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
}

export async function resolveImageApiAuth(options = {}) {
  const defaultModel = options.defaultModel || "gpt-image-2";
  const diagnostics = [];
  const imageEnv = await loadImageEnvConfig({ configPath: options.configPath });
  const useStandaloneImageEnv = Boolean(imageEnv.config);
  const providerId = useStandaloneImageEnv ? "image_env" : "explicit";
  const imageEnvKeyName = pickConfigValue(imageEnv.config, ["key_env", "keyEnv", "env_key", "envKey"]);
  const envKeyName = options.apiKeyEnv || process.env.GPT_IMAGE_API_KEY_ENV || imageEnvKeyName || "OPENAI_API_KEY";
  const imageEnvHttpClient = pickConfigValue(imageEnv.config, ["http_client", "httpClient", "client"]);
  const httpClient = String(options.httpClient || process.env.GPT_IMAGE_HTTP_CLIENT || imageEnvHttpClient || "curl").toLowerCase();
  if (!["curl", "fetch", "auto"].includes(httpClient)) {
    throw new Error(`Invalid image API http_client "${httpClient}". Use "curl", "fetch", or "auto".`);
  }
  const imageEnvUserAgent = pickConfigValue(imageEnv.config, ["user_agent", "userAgent"]);
  const userAgent = options.userAgent || process.env.GPT_IMAGE_USER_AGENT || imageEnvUserAgent || "codex";

  let baseUrl = options.baseUrl || process.env.GPT_IMAGE_BASE_URL || process.env.OPENAI_BASE_URL || null;
  let baseUrlSource = options.baseUrl
    ? "cli:base-url"
    : process.env.GPT_IMAGE_BASE_URL
      ? "env:GPT_IMAGE_BASE_URL"
      : process.env.OPENAI_BASE_URL
        ? "env:OPENAI_BASE_URL"
        : null;

  if (!baseUrl && imageEnv.config) {
    baseUrl = pickConfigValue(imageEnv.config, ["base_url", "baseUrl", "url", "api_url", "apiUrl"]);
    if (baseUrl) baseUrlSource = `image_env:${imageEnv.path}:base_url`;
  }

  if (!baseUrl) {
    baseUrl = DEFAULT_BASE_URL;
    baseUrlSource = "default";
  }

  const normalizedBaseUrl = normalizeBaseUrl(baseUrl, { autoAppendV1: options.autoAppendV1 });

  let apiKey = options.apiKey || process.env.GPT_IMAGE_API_KEY || null;
  let apiKeySource = options.apiKey ? "cli:api-key" : process.env.GPT_IMAGE_API_KEY ? "env:GPT_IMAGE_API_KEY" : null;

  if (!apiKey && envKeyName && process.env[envKeyName]) {
    apiKey = process.env[envKeyName];
    apiKeySource = `env:${envKeyName}`;
  }

  if (!apiKey && imageEnv.config) {
    apiKey = pickConfigValue(imageEnv.config, ["key", "api_key", "apiKey"]);
    if (apiKey) apiKeySource = `image_env:${imageEnv.path}:key`;
  }

  if (!apiKey && process.env.OPENAI_API_KEY) {
    apiKey = process.env.OPENAI_API_KEY;
    apiKeySource = "env:OPENAI_API_KEY";
  }

  if (!apiKey && imageEnv.config) {
    diagnostics.push(`Loaded ${imageEnv.path}, but no image API key was configured. Fill "key" or set "key_env" to an environment variable name.`);
  } else if (!apiKey) {
    const keyHint = envKeyName && envKeyName !== "OPENAI_API_KEY" ? `${envKeyName} or OPENAI_API_KEY` : "OPENAI_API_KEY";
    diagnostics.push(`No image API key configured. Set ${keyHint}, GPT_IMAGE_API_KEY, or an image_env key explicitly.`);
  }

  const imageEnvModel = pickConfigValue(imageEnv.config, ["model_name", "modelName", "model"]);
  const model = options.model || process.env.GPT_IMAGE_MODEL || process.env.OPENAI_IMAGE_MODEL || imageEnvModel || defaultModel;
  const modelSource = options.model
    ? "cli:model"
    : process.env.GPT_IMAGE_MODEL
      ? "env:GPT_IMAGE_MODEL"
      : process.env.OPENAI_IMAGE_MODEL
        ? "env:OPENAI_IMAGE_MODEL"
        : imageEnvModel
          ? `image_env:${imageEnv.path}:model_name`
          : "default";

  return {
    apiKey: apiKey || null,
    baseUrl: normalizedBaseUrl,
    model,
    providerId,
    envKeyName,
    imageEnvPath: imageEnv.path,
    httpClient,
    userAgent,
    directApi: useStandaloneImageEnv,
    hasApiKey: Boolean(apiKey),
    apiKeySource,
    baseUrlSource,
    modelSource,
    configPath: null,
    diagnostics,
  };
}
