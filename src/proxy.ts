#!/usr/bin/env bun
// @ts-nocheck
// Always-on proxy the `cc` wrapper points ANTHROPIC_BASE_URL at; dispatches each
// request to the active provider's handler module discovered from repos/.

import { existsSync, readFileSync, mkdirSync, appendFileSync, readdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const PORT = parseInt(process.env.HUB_PROXY_PORT || "34567", 10);
const CONFIG_DIR = process.env.HUB_CONFIG_DIR
  || (existsSync(join(homedir(), ".claude")) ? join(homedir(), ".claude") : join(homedir(), ".config", "opencode"));
const CONFIG_FOLDER = join(CONFIG_DIR, "config");
const REPOS_DIR = join(CONFIG_DIR, "repos");
const LOADER_CONFIG = join(CONFIG_FOLDER, "claude-code-loader.json");
const START_TIME = new Date().toISOString().replace(/:/g, "-").split(".")[0];

function log(message) {
  try {
    const dateStr = new Date().toISOString().split("T")[0];
    const logsDir = join(CONFIG_DIR, "logs", dateStr);
    if (!existsSync(logsDir)) mkdirSync(logsDir, { recursive: true });
    appendFileSync(join(logsDir, "loader-proxy-" + START_TIME + ".log"), "[" + new Date().toISOString() + "] " + message + "\n");
  } catch {}
}

function loaderConfig() {
  try {
    if (existsSync(LOADER_CONFIG)) return JSON.parse(readFileSync(LOADER_CONFIG, "utf8"));
  } catch {}
  return {};
}

function activeProvider() {
  return loaderConfig().provider || "";
}

function claudeSlot(model) {
  const m = (model || "").toLowerCase();
  if (m.indexOf("opus") >= 0) return "opus";
  if (m.indexOf("sonnet") >= 0) return "sonnet";
  if (m.indexOf("haiku") >= 0) return "haiku";
  return "default";
}

// map Claude's requested model to the active provider's model via the cc
// Providers tab assignment (modelMap[provider][slot])
async function resolveModel(provider, request) {
  let requested = "";
  try { requested = ((await request.clone().json()) || {}).model || ""; } catch {}
  const map = (loaderConfig().modelMap || {})[provider] || {};
  return map[claudeSlot(requested)] || map[requested] || map["default"] || requested;
}

// resolve the handler module a provider plugin declares, by scanning manifests
let HANDLER_CACHE = {};
function resolveHandler(providerName) {
  if (HANDLER_CACHE[providerName] !== undefined) return HANDLER_CACHE[providerName];
  let resolved = null;
  try {
    for (const repo of readdirSync(REPOS_DIR)) {
      try {
        const pkg = JSON.parse(readFileSync(join(REPOS_DIR, repo, "package.json"), "utf8"));
        const declared = (pkg.claudeHub && pkg.claudeHub.authProviders) || pkg.authProviders || [];
        const match = declared.find((p) => (p.name || repo) === providerName);
        if (match && match.handler) {
          resolved = join(REPOS_DIR, repo, match.handler);
          break;
        }
      } catch {}
    }
  } catch {}
  HANDLER_CACHE[providerName] = resolved;
  return resolved;
}

function errorResponse(status, message) {
  return new Response(JSON.stringify({ type: "error", error: { type: "loader_proxy_error", message } }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function route(request) {
  const url = new URL(request.url);
  if (url.pathname === "/health") return new Response("ok", { status: 200 });

  const provider = activeProvider();
  if (!provider) {
    return errorResponse(503, "No AI provider selected. Run the loader (cc) -> Plugins -> Providers to choose one.");
  }

  const handlerPath = resolveHandler(provider);
  if (!handlerPath || !existsSync(handlerPath)) {
    return errorResponse(503, "Provider '" + provider + "' has no proxy handler installed.");
  }

  try {
    const mod = await import(handlerPath);
    if (typeof mod.handle !== "function") return errorResponse(500, "Provider '" + provider + "' handler exports no handle()");
    const model = await resolveModel(provider, request);
    return await mod.handle(request, { configDir: CONFIG_DIR, log, model });
  } catch (e) {
    log("handler error for " + provider + ": " + (e && e.message));
    return errorResponse(502, "Provider handler failed: " + (e && e.message));
  }
}

log("Loader proxy listening on 127.0.0.1:" + PORT);
Bun.serve({
  port: PORT,
  hostname: "127.0.0.1",
  idleTimeout: 0,
  fetch: route,
});
