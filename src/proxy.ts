#!/usr/bin/env bun
// @ts-nocheck
// Always-on router proxy (Claude Code only): a single stable endpoint the app
// points at so login/onboarding is skipped and the target never changes. Each
// request is dispatched to the active provider's handler module; with no
// provider selected it answers 503. OpenCode handles providers natively and
// does not use this.

import { existsSync, mkdirSync, appendFileSync } from "fs";
import { join } from "path";
import { getConfigDir, activeProviderName, findProvider, loaderConfig } from "./providers.js";

const PORT = parseInt(process.env.HUB_PROXY_PORT || "34567", 10);
const CONFIG_DIR = getConfigDir();
const START_TIME = new Date().toISOString().replace(/:/g, "-").split(".")[0];

function log(message: string) {
  if (loaderConfig().logging === false) return;
  try {
    const dateStr = new Date().toISOString().split("T")[0];
    const logsDir = join(CONFIG_DIR, "logs", dateStr);
    if (!existsSync(logsDir)) mkdirSync(logsDir, { recursive: true });
    appendFileSync(join(logsDir, "claude-code-loader-proxy-" + START_TIME + ".log"),
      "[" + new Date().toISOString() + "] " + message + "\n");
  } catch {}
}

const HANDLER_CACHE: Record<string, string | null> = {};
function resolveHandler(providerName: string): string | null {
  if (HANDLER_CACHE[providerName] !== undefined) return HANDLER_CACHE[providerName];
  const decl = findProvider(providerName);
  HANDLER_CACHE[providerName] = decl && decl.handler && existsSync(decl.handler) ? decl.handler : null;
  return HANDLER_CACHE[providerName];
}

function errorResponse(status: number, message: string) {
  return new Response(JSON.stringify({ type: "error", error: { type: "loader_proxy_error", message } }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function route(request: Request) {
  const url = new URL(request.url);
  if (url.pathname === "/health") return new Response("ok", { status: 200 });

  const provider = activeProviderName();
  if (!provider) {
    return errorResponse(503, "No AI provider selected. Run cc -> Plugins -> Provider to choose one.");
  }

  const handlerPath = resolveHandler(provider);
  if (!handlerPath) {
    return errorResponse(503, "Provider '" + provider + "' has no proxy handler installed.");
  }

  try {
    const mod = await import(handlerPath);
    if (typeof mod.handle !== "function") return errorResponse(500, "Provider '" + provider + "' handler exports no handle()");
    return await mod.handle(request, { configDir: CONFIG_DIR, log });
  } catch (e: any) {
    log("handler error for " + provider + ": " + (e && e.message));
    return errorResponse(502, "Provider handler failed: " + (e && e.message));
  }
}

log("Loader proxy listening on 127.0.0.1:" + PORT);
Bun.serve({ port: PORT, hostname: "127.0.0.1", idleTimeout: 0, fetch: route });
