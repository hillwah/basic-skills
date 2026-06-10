import path from "node:path";
import process from "node:process";
import { homedir } from "node:os";
import { readFile } from "node:fs/promises";

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const CONFIG_BASENAME = "image_env";
const FALSEY = new Set(["0", "false", "no", "off", "n"]);
const API_KEY_NAMES = new Set([
  "OPENAI_API_KEY",
  "openai_api_key",
  "openaiApiKey",
  "api_key",
  "apiKey",
]);

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

function parseTomlValue(raw) {
  const value = raw.trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}

function ensureSection(root, parts) {
  let target = root;
  for (const part of parts) {
    target[part] = target[part] || {};
    target = target[part];
  }
  return target;
}

export function parseBasicToml(text) {
  const root = {};
  let current = root;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = stripComment(rawLine).trim();
    if (!line) continue;

    const section = line.match(/^\[([^\]]+)\]$/);
    if (section) {
      current = ensureSection(root, section[1].split(".").map((part) => part.trim()).filter(Boolean));
      continue;
    }

    const pivot = line.indexOf("=");
    if (pivot === -1) continue;
    const key = line.slice(0, pivot).trim();
    const value = parseTomlValue(line.slice(pivot + 1));
    if (key) current[key] = value;
  }

  return root;
}

async function readJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
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

async function readToml(filePath) {
  try {
    return parseBasicToml(await readFile(filePath, "utf8"));
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

function looksLikePlatformApiKey(value) {
  return typeof value === "string" && /^sk-[A-Za-z0-9_-]+/.test(value.trim());
}

function findApiKeyInObject(value, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return null;
  seen.add(value);

  for (const [key, item] of Object.entries(value)) {
    if (API_KEY_NAMES.has(key) && looksLikePlatformApiKey(item)) {
      return { apiKey: item.trim(), keyPath: key };
    }
  }

  for (const [key, item] of Object.entries(value)) {
    if (item && typeof item === "object") {
      const found = findApiKeyInObject(item, seen);
      if (found) return { apiKey: found.apiKey, keyPath: `${key}.${found.keyPath}` };
    }
  }

  return null;
}

async function loadCodexConfig() {
  const configPath = path.join(codexHome(), "config.toml");
  const config = await readToml(configPath);
  return { config, configPath };
}

async function loadCodexAuthApiKey() {
  const authPath = path.join(codexHome(), "auth.json");
  const auth = await readJson(authPath);
  const found = findApiKeyInObject(auth);
  if (!found) return { apiKey: null, authPath, keyPath: null };
  return { apiKey: found.apiKey, authPath, keyPath: found.keyPath };
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

function codexAuthPath() {
  return path.join(codexHome(), "auth.json");
}

function selectedProvider(config) {
  const providerId = String(config?.model_provider || "openai");
  const provider = config?.model_providers?.[providerId] || null;
  return { providerId, provider };
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

function isOfficialOpenAIBaseUrl(baseUrl) {
  try {
    const { hostname } = new URL(baseUrl);
    return hostname === "api.openai.com" || hostname.endsWith(".api.openai.com");
  } catch {
    return false;
  }
}

export async function resolveImageApiAuth(options = {}) {
  const defaultModel = options.defaultModel || "gpt-image-2";
  const diagnostics = [];
  const imageEnv = await loadImageEnvConfig({ configPath: options.configPath });
  const { config, configPath } = await loadCodexConfig();
  const { providerId, provider } = selectedProvider(config);
  const imageEnvKeyName = pickConfigValue(imageEnv.config, ["key_env", "keyEnv", "env_key", "envKey"]);
  const envKeyName = options.apiKeyEnv || process.env.GPT_IMAGE_API_KEY_ENV || imageEnvKeyName || provider?.env_key || "OPENAI_API_KEY";

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

  if (!baseUrl && provider?.base_url) {
    baseUrl = provider.base_url;
    baseUrlSource = `codex:${configPath}:model_providers.${providerId}.base_url`;
  }

  if (!baseUrl && config?.openai_base_url) {
    baseUrl = config.openai_base_url;
    baseUrlSource = `codex:${configPath}:openai_base_url`;
  }

  if (!baseUrl) {
    baseUrl = DEFAULT_BASE_URL;
    baseUrlSource = "default";
  }

  const normalizedBaseUrl = normalizeBaseUrl(baseUrl, { autoAppendV1: options.autoAppendV1 });
  const canUseCodexAuthCache = isOfficialOpenAIBaseUrl(normalizedBaseUrl) && !imageEnv.config;

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

  if (!apiKey && process.env.CODEX_API_KEY && (canUseCodexAuthCache || envKeyName === "CODEX_API_KEY")) {
    apiKey = process.env.CODEX_API_KEY;
    apiKeySource = "env:CODEX_API_KEY";
  }

  if (!apiKey && canUseCodexAuthCache) {
    const auth = await loadCodexAuthApiKey();
    if (auth.apiKey) {
      apiKey = auth.apiKey;
      apiKeySource = `codex:${auth.authPath}:${auth.keyPath}`;
    } else {
      diagnostics.push(`No Platform API key found in ${auth.authPath}. ChatGPT/Codex access tokens are not used for direct Images API calls.`);
    }
  }

  if (!apiKey && imageEnv.config) {
    diagnostics.push(`Loaded ${imageEnv.path}, but no image API key was configured. Fill "key" or set "key_env" to an environment variable name.`);
  } else if (!apiKey && !canUseCodexAuthCache) {
    const keyHint = envKeyName && envKeyName !== "OPENAI_API_KEY" ? `${envKeyName} or OPENAI_API_KEY` : "OPENAI_API_KEY";
    diagnostics.push(`Skipped Codex auth cache for custom base URL ${normalizedBaseUrl}. Set ${keyHint} explicitly for this gateway.`);
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

  if (!imageEnv.config && provider?.requires_openai_auth && !apiKey && !canUseCodexAuthCache) {
    diagnostics.push(`Codex provider "${providerId}" uses requires_openai_auth, but direct Images API calls to custom gateways need an explicit gateway API key.`);
  } else if (!imageEnv.config && provider?.requires_openai_auth && !apiKey) {
    diagnostics.push(`Codex provider "${providerId}" requires OpenAI auth, but no API-key login was available to this script.`);
  }

  return {
    apiKey: apiKey || null,
    baseUrl: normalizedBaseUrl,
    model,
    providerId,
    envKeyName,
    imageEnvPath: imageEnv.path,
    hasApiKey: Boolean(apiKey),
    apiKeySource,
    baseUrlSource,
    modelSource,
    configPath,
    diagnostics,
  };
}
