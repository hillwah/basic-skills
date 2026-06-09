import path from "node:path";
import process from "node:process";
import { homedir } from "node:os";
import { readFile } from "node:fs/promises";

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
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

async function readToml(filePath) {
  try {
    return parseBasicToml(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

function codexHome() {
  return process.env.CODEX_HOME || path.join(homedir(), ".codex");
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

export async function resolveImageApiAuth(options = {}) {
  const defaultModel = options.defaultModel || "gpt-image-2";
  const diagnostics = [];
  const { config, configPath } = await loadCodexConfig();
  const { providerId, provider } = selectedProvider(config);
  const envKeyName = options.apiKeyEnv || provider?.env_key || "OPENAI_API_KEY";

  let baseUrl = options.baseUrl || process.env.OPENAI_BASE_URL || null;
  let baseUrlSource = options.baseUrl ? "cli:base-url" : process.env.OPENAI_BASE_URL ? "env:OPENAI_BASE_URL" : null;

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

  let apiKey = options.apiKey || null;
  let apiKeySource = options.apiKey ? "cli:api-key" : null;

  if (!apiKey && envKeyName && process.env[envKeyName]) {
    apiKey = process.env[envKeyName];
    apiKeySource = `env:${envKeyName}`;
  }

  if (!apiKey && process.env.OPENAI_API_KEY) {
    apiKey = process.env.OPENAI_API_KEY;
    apiKeySource = "env:OPENAI_API_KEY";
  }

  if (!apiKey && process.env.CODEX_API_KEY) {
    apiKey = process.env.CODEX_API_KEY;
    apiKeySource = "env:CODEX_API_KEY";
  }

  if (!apiKey) {
    const auth = await loadCodexAuthApiKey();
    if (auth.apiKey) {
      apiKey = auth.apiKey;
      apiKeySource = `codex:${auth.authPath}:${auth.keyPath}`;
    } else {
      diagnostics.push(`No Platform API key found in ${auth.authPath}. ChatGPT/Codex access tokens are not used for direct Images API calls.`);
    }
  }

  const model = options.model || process.env.OPENAI_IMAGE_MODEL || defaultModel;
  const modelSource = options.model ? "cli:model" : process.env.OPENAI_IMAGE_MODEL ? "env:OPENAI_IMAGE_MODEL" : "default";

  if (provider?.requires_openai_auth && !apiKey) {
    diagnostics.push(`Codex provider "${providerId}" requires OpenAI auth, but no API-key login was available to this script.`);
  }

  return {
    apiKey: apiKey || null,
    baseUrl: normalizeBaseUrl(baseUrl, { autoAppendV1: options.autoAppendV1 }),
    model,
    providerId,
    envKeyName,
    hasApiKey: Boolean(apiKey),
    apiKeySource,
    baseUrlSource,
    modelSource,
    configPath,
    diagnostics,
  };
}
