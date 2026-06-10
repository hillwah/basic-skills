#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import { mkdir, writeFile } from "node:fs/promises";
import { defaultImageEnvConfigPath } from "./auth-resolver.js";

function parseCli(argv) {
  const cfg = {
    output: null,
    format: "json",
    force: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      cfg.help = true;
      continue;
    }
    if (arg === "--force") {
      cfg.force = true;
      continue;
    }
    if (arg === "--output") {
      cfg.output = argv[++i] || null;
      if (!cfg.output) throw new Error("Missing value for --output");
      continue;
    }
    if (arg === "--format") {
      cfg.format = argv[++i] || null;
      if (!["json", "yaml"].includes(cfg.format)) throw new Error("--format must be json or yaml");
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  return cfg;
}

function printHelp() {
  console.log(`Usage:
  node skills/gpt-image-2/scripts/init-image-env.js

Options:
  --output <path>     Config path (default: $CODEX_HOME/image_env.json or ~/.codex/image_env.json)
  --format <json|yaml>
  --force             Overwrite existing file
  -h, --help          Show help`);
}

function template(format) {
  const data = {
    model_name: "gpt-image-2",
    base_url: "https://api.openai.com/v1",
    key: "",
    http_client: "curl",
    user_agent: "codex",
  };

  if (format === "yaml") {
    return [
      "model_name: gpt-image-2",
      "base_url: https://api.openai.com/v1",
      "key: \"\"",
      "http_client: curl",
      "user_agent: codex",
      "",
    ].join("\n");
  }

  return `${JSON.stringify(data, null, 2)}\n`;
}

async function run() {
  const cfg = parseCli(process.argv.slice(2));
  if (cfg.help) {
    printHelp();
    return;
  }

  const fallbackPath = defaultImageEnvConfigPath();
  const output = path.resolve(cfg.output || (cfg.format === "yaml" ? fallbackPath.replace(/\.json$/, ".yaml") : fallbackPath));
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, template(cfg.format), { encoding: "utf8", flag: cfg.force ? "w" : "wx" });
  console.log(output);
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
