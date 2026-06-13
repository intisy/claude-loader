// @ts-nocheck
// Custom TUI tab (loaded via HUB_TUI_EXTENSION): pick the active provider and
// map Claude's model tiers to that provider's models.

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const SLOTS = ["opus", "sonnet", "haiku"];

function configDir() { return process.env.HUB_CONFIG_DIR || join(homedir(), ".claude"); }
function reposDir() { return join(configDir(), "repos"); }
// the loader config the proxy reads, not core-loader's oc-config.json
function configPath() { return join(configDir(), "config", "claude-code-loader.json"); }

function readConfig() {
  try { if (existsSync(configPath())) return JSON.parse(readFileSync(configPath(), "utf8")); } catch {}
  return {};
}

function writeConfig(cfg) {
  try {
    const dir = join(configDir(), "config");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(configPath(), JSON.stringify(cfg, null, 2), "utf8");
  } catch {}
}

function loadProviders() {
  const out = [];
  let repos = [];
  try { repos = readdirSync(reposDir()); } catch { return out; }
  for (const repo of repos) {
    try {
      const pkg = JSON.parse(readFileSync(join(reposDir(), repo, "package.json"), "utf8"));
      const declared = (pkg.claudeHub && pkg.claudeHub.authProviders) || pkg.authProviders || [];
      for (const p of declared) {
        const models = (p.models || []).map((m) => (typeof m === "string" ? { id: m, name: m } : m));
        out.push({ name: p.name || repo, models });
      }
    } catch {}
  }
  return out;
}

let cursor = 0;

function render(state, h) {
  const providers = loadProviders();
  const cfg = readConfig();
  const active = cfg.provider || "";
  const map = (cfg.modelMap || {})[active] || {};
  const activeProvider = providers.find((p) => p.name === active);
  const total = providers.length + SLOTS.length;
  if (cursor >= total) cursor = Math.max(0, total - 1);

  h.pushBody("  " + h.MAGENTA + "#" + h.GRAY + " Providers (" + providers.length + ")" + h.RST, false);
  if (providers.length === 0) {
    h.pushBody("  " + h.GRAY + "No providers installed (e.g. plugin-updater add <repo>)." + h.RST, false);
  }
  providers.forEach((p, i) => {
    const sel = cursor === i;
    const icon = p.name === active ? (h.GREEN + "●" + h.RST) : (h.GRAY + "○" + h.RST);
    const arrow = sel ? (h.YELLOW + " > " + h.RST) : "   ";
    const tag = p.name === active ? (h.DIM + "  [active]" + h.RST) : "";
    h.pushBody("  " + (sel ? h.BG_SEL : "") + arrow + icon + " " + (sel ? h.BOLD + h.WHITE : h.DIM) + p.name + h.RST + tag, sel);
  });

  h.pushBody("", false);
  h.pushBody("  " + h.MAGENTA + "#" + h.GRAY + " Claude model mapping" + (active ? " (provider: " + active + ")" : "") + h.RST, false);
  if (!active) {
    h.pushBody("  " + h.GRAY + "Select a provider above to map its models." + h.RST, false);
  } else if (!activeProvider || activeProvider.models.length === 0) {
    h.pushBody("  " + h.GRAY + "Active provider declares no models." + h.RST, false);
  } else {
    SLOTS.forEach((slot, si) => {
      const sel = cursor === providers.length + si;
      const label = slot.charAt(0).toUpperCase() + slot.slice(1);
      const assigned = map[slot] || "(unset)";
      const arrow = sel ? (h.YELLOW + " > " + h.RST) : "   ";
      h.pushBody("  " + (sel ? h.BG_SEL : "") + arrow + (sel ? h.BOLD + h.WHITE : h.GRAY) + h.pad(label, 8) + h.RST +
        h.GRAY + " -> " + h.RST + h.CYAN + assigned + h.RST, sel);
    });
  }

  h.pushBody("", false);
  h.pushFoot("  " + h.GRAY + "-".repeat(h.barW) + h.RST);
  h.pushFoot("  " + h.DIM + "^v Move   Enter " + (cursor < providers.length ? "Activate provider" : "Cycle model") + "   Tab Switch   Q Quit" + h.RST);
}

function handleKey(key, state, tuiApi) {
  const providers = loadProviders();
  const total = providers.length + SLOTS.length;
  if (total === 0) return;
  if (key === "up" || key === "w") { cursor = (cursor - 1 + total) % total; return; }
  if (key === "down" || key === "s") { cursor = (cursor + 1) % total; return; }
  if (key !== "enter" && key !== "space") return;

  const cfg = readConfig();
  if (cursor < providers.length) {
    cfg.provider = providers[cursor].name;
    writeConfig(cfg);
    if (tuiApi && tuiApi.flash) tuiApi.flash("Active provider: " + cfg.provider);
    return;
  }
  const active = cfg.provider || "";
  const provider = providers.find((p) => p.name === active);
  if (!provider || provider.models.length === 0) return;
  const slot = SLOTS[cursor - providers.length];
  cfg.modelMap = cfg.modelMap || {};
  cfg.modelMap[active] = cfg.modelMap[active] || {};
  const current = cfg.modelMap[active][slot];
  const index = provider.models.findIndex((m) => m.id === current);
  const next = provider.models[(index + 1) % provider.models.length];
  cfg.modelMap[active][slot] = next.id;
  writeConfig(cfg);
  if (tuiApi && tuiApi.flash) tuiApi.flash(slot + " -> " + next.id);
}

export default function (tuiApi) {
  tuiApi.registerTab({ id: "providers", label: "Providers", render, handleKey });
}
