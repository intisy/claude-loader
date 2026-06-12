// Provider discovery and active-provider selection. Shared by the proxy daemon
// and the Providers tab. A provider is any installed plugin that declares
// `claudeHub.authProviders[]` in its package.json. No provider is hardcoded.

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";

export interface ProviderDecl {
  name: string;            // provider id, e.g. "antigravity"
  plugin: string;          // repo folder the declaration came from
  handler: string | null;  // absolute path to a module exporting handle(request, ctx)
  auth: string | null;     // absolute path to a module exporting the auth contract
}

export function getConfigDir(): string {
  return process.env.HUB_CONFIG_DIR
    || (existsSync(join(homedir(), ".claude")) ? join(homedir(), ".claude") : join(homedir(), ".config", "claude"));
}

function reposDir(): string {
  return join(getConfigDir(), "repos");
}

// loader config lives in config/claude-code-loader.json (preferred) or the
// top-level fallback; the active provider is stored under `.provider`
function loaderConfigPaths(): { preferred: string; fallback: string } {
  const dir = getConfigDir();
  return {
    preferred: join(dir, "config", "claude-code-loader.json"),
    fallback: join(dir, "claude-code-loader.json"),
  };
}

export function loaderConfig(): Record<string, any> {
  const { preferred, fallback } = loaderConfigPaths();
  const p = existsSync(preferred) ? preferred : existsSync(fallback) ? fallback : null;
  try { return p ? JSON.parse(readFileSync(p, "utf8")) : {}; } catch { return {}; }
}

export function activeProviderName(): string {
  return loaderConfig().provider || "";
}

export function setActiveProvider(name: string): void {
  const { preferred } = loaderConfigPaths();
  const cfg = loaderConfig();
  cfg.provider = name;
  try {
    if (!existsSync(dirname(preferred))) mkdirSync(dirname(preferred), { recursive: true });
    writeFileSync(preferred, JSON.stringify(cfg, null, 2), "utf8");
  } catch {}
}

export function discoverProviders(): ProviderDecl[] {
  const out: ProviderDecl[] = [];
  let repos: string[] = [];
  try { repos = readdirSync(reposDir()); } catch { return out; }
  for (const repo of repos) {
    try {
      const pkg = JSON.parse(readFileSync(join(reposDir(), repo, "package.json"), "utf8"));
      const declared = (pkg.claudeHub && pkg.claudeHub.authProviders) || pkg.authProviders || [];
      for (const p of declared) {
        out.push({
          name: p.name || repo,
          plugin: repo,
          handler: p.handler ? join(reposDir(), repo, p.handler) : null,
          auth: p.auth ? join(reposDir(), repo, p.auth) : null,
        });
      }
    } catch {}
  }
  return out;
}

export function findProvider(name: string): ProviderDecl | null {
  return discoverProviders().find((p) => p.name === name) || null;
}
