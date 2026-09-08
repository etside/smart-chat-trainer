# ClawHub Skills & Plugins Manifest

Desired + installed skills/plugins for the OpenClaw gateway, aligned with the
daddyai goal: a **one-stop low-cost AI business sales agent** (messaging,
outreach, research, self-improvement, autonomous code work on the daddyai project).

## Installed skills (on VPS, ~/.openclaw/skills/) — updated 2026-09-01

| Skill | Slug | Why for daddyai | Status |
|---|---|---|---|
| `find-skills` | `@isainazar/openclaw-find-skills` | Discover/install more skills from the ecosystem | ✅ installed |
| `web-search-free` | `@deciding/web-search-free` | Free AI search via Exa MCP — no API key needed | ✅ installed |
| `free-web-search` | `@ucsdzehualiu/free-web-search` | Free Bing/DDG search (CN-friendly) | ✅ installed |
| `web-crawler` | `@moxin1044/web-crawler` | Build Python crawlers/scrapers for research | ✅ installed |
| `web-content-fetcher` | `@mrtommywu/web-content-fetcher` | Fetch page→markdown when crawlers are filtered (r.jina.ai etc.) | ✅ installed |

> Install command used: `openclaw skills install @owner/slug --global`

## Planned skills (from clawhub.ai)

| Skill | Author | Why for daddyai | Status |
|---|---|---|---|
| `reddit-automation` | flowkit-labs | Find prospects who need a sales agent, suggest disclosed replies | 🔲 planned |
| `ClawCall` | clawcall-dev | US phone calls — booking/outreach from the agent | 🔲 planned |
| `Muse` | alexander-morris | Give the agent the full coding history to work autonomously on daddyai | 🔲 planned |
| `self-improving agent` | pskoett | Capture learnings/errors for continuous agent improvement | 🔲 planned |
| `google-search` | fetcher-sh | Cheap SERP data for market/prospect research | 🔲 optional (pay-per-call) |
| `google-news-api` | fetcher-sh | News monitoring for prospects/competitors | 🔲 optional |

## Plugins

| Plugin | Why | Status |
|---|---|---|
| `telegram` (official, bundled) | Real-time channel — DM with the user, proactive messages, commands, voice | ✅ chosen (config in openclaw.config.json) |
| `openclaw-wechat` (`clawhub:openclaw-wechat`) | WeChat (Weixin) channel via iLink bot API — NOT used (replaced by Telegram 2026-09-01) | 🔲 disabled |

## Install flow (from docs.openclaw.ai/clawhub)

```bash
# skills
openclaw skills install @owner/slug --global
# plugins
openclaw plugins install clawhub:openclaw-wechat
```

> Note: The B.AI `deepseek-v4-flash` model is free (cost = 0), so "forever low-cost"
> is already satisfied for inference. `web-search-free` (Exa MCP) is also free —
> pay-per-call skills (fetcher.sh) are optional only if we want paid data sources.

## Next steps

1. Install WeChat channel plugin + pair via QR scan (requires user action).
2. Evaluate `Muse` / `self-improving agent` for autonomous code work on daddyai.
3. Re-run `openclaw skills install` from this manifest on any new machine to reproduce.
