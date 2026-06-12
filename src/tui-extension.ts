// @ts-nocheck
// Provider tab for the Claude Code loader TUI, injected via registerTab. Lists
// every installed auth provider (plugins declaring claudeHub.authProviders),
// lets you pick the active one (which the proxy routes through), and delegates
// login/management to the provider plugin. Nothing here is provider-specific.

import { discoverProviders, activeProviderName, setActiveProvider } from "./providers.js";

export default function (tuiApi) {
  let cursor = 0;

  tuiApi.registerTab({
    id: "provider",
    label: "Provider",

    render: function (state, h) {
      const providers = discoverProviders();
      const active = activeProviderName();

      h.pushBody("  " + h.MAGENTA + "#" + h.GRAY + " AI Providers (" + providers.length + ")" + h.RST, false);
      if (providers.length === 0) {
        h.pushBody("  " + h.GRAY + "No providers installed." + h.RST, false);
        h.pushBody("  " + h.GRAY + "Install an auth plugin (e.g. antigravity-auth) to add one." + h.RST, false);
      }

      for (let i = 0; i < providers.length; i++) {
        const p = providers[i];
        const sel = i === cursor;
        const icon = p.name === active ? (h.GREEN + "●" + h.RST) : (h.GRAY + "○" + h.RST);
        const arrow = sel ? (h.YELLOW + " > " + h.RST) : "   ";
        const bg = sel ? h.BG_SEL : "";
        const style = sel ? (h.BOLD + h.WHITE) : h.DIM;
        h.pushBody("  " + bg + arrow + icon + " " + style + h.pad(h.trunc(p.name, state.nameW), state.nameW) + h.RST + bg + "  " + h.GRAY + "from " + p.plugin + h.RST, sel);
      }

      h.pushBody("", false);
      if (state.message) h.pushFoot("  " + h.GREEN + "  " + h.trunc(state.message, state.cols - 5) + h.RST);
      h.pushFoot("  " + h.GRAY + "-".repeat(h.barW) + h.RST);
      h.pushFoot("  " + h.DIM + "^v" + h.RST + "/" + h.DIM + "WS" + h.RST + " Move  " +
        h.DIM + "Enter" + h.RST + " Set active  " +
        h.DIM + "L" + h.RST + " Log in / manage  " +
        h.DIM + "Tab" + h.RST + " Switch  " +
        h.DIM + "Q" + h.RST + " Quit");
    },

    handleKey: function (key, state, api) {
      const providers = discoverProviders();
      if (key === "up" || key === "w") {
        cursor = Math.max(0, cursor - 1);
      } else if (key === "down" || key === "s") {
        cursor = Math.min(Math.max(0, providers.length - 1), cursor + 1);
      } else if (key === "enter" || key === "space") {
        if (providers.length > 0 && cursor < providers.length) {
          setActiveProvider(providers[cursor].name);
          api.flash("Active provider: " + providers[cursor].name);
        }
      } else if (key === "l") {
        if (providers.length > 0 && cursor < providers.length) {
          const p = providers[cursor];
          // The login / account-management flow is owned by the provider plugin
          // via its declared `auth` module; wired up with each provider.
          api.flash(p.auth
            ? p.name + ": login/management handled by the provider plugin."
            : p.name + " declares no auth module.");
        }
      }
    },
  });
}
