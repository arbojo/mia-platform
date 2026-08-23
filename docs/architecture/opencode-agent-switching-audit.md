# OpenCode Agent Switching — Forensic Audit

**Date**: 2026-08-23
**Question**: Can MIA's Engineering Loop programmatically select between Nemotron and Big Pickle through OpenCode, instead of a human typing `/agents` manually in the TUI?
**Method**: Read-only inspection of installed binary, CLI help surfaces, global config, SDK type definitions, and model registry. No production code modified.
**OpenCode version**: 1.18.21 (`C:\ProgramData\chocolatey\bin\opencode.exe`, installed via Chocolatey)

---

## Classification

# YES

Programmatic selection is fully supported — with one critical correction to the premise:

> **Nemotron and Big Pickle are MODELS, not agents.**

The manual workflow the user performs is model switching (single provider `opencode`), not agent selection. OpenCode exposes both dimensions programmatically, but the relevant axis for the Engineering Loop is `--model`.

---

## Evidence

| # | Claim | Evidence |
|---|-------|----------|
| E1 | Only built-in agents exist | `opencode agent list` → `build`, `plan`, `general`, `explore`, `compaction`, `title`, `summary`. No Nemotron/Big Pickle agents. |
| E2 | Nemotron/Big Pickle are models of provider `opencode` | `opencode models` → `opencode/big-pickle`, `opencode/nemotron-3-ultra-free`, `opencode/nemotron-3.5-lightning-free`. Sole provider listed: `opencode`. |
| E3 | Current session runs on big-pickle | Active session system prompt states: model ID `opencode/big-pickle`. |
| E4 | CLI supports non-interactive model selection | `opencode run --help` → flags `-m/--model <provider/model>`, `--agent <string>`, `-s/--session <id>`, `-c/--continue`, `--fork`, `--format json`, `--attach <url>`, `--auto`. |
| E5 | Headless server exists | `opencode serve` (global help) with `--port`, `--hostname`; plus `opencode attach <url>` and `opencode acp` (Agent Client Protocol). |
| E6 | HTTP API accepts per-request model | `~/.config/opencode/node_modules/@opencode-ai/sdk/dist/gen/types.gen.d.ts` → `SessionPromptData` contains `providerID: string; modelID: string;` consumed by `client.prompt(...)` / `promptAsync(...)` in `sdk.gen.d.ts`. |
| E7 | Sessions persist across invocations | `opencode session list` returns durable session IDs (e.g., `ses_fd2b79058fferSSeK5OcE0QegD`); state stored in `%USERPROFILE%\.local\share\opencode\opencode.db` (SQLite + WAL). |
| E8 | Global config has no custom agents/models | `~/.config/opencode/opencode.jsonc` contains only MCP (supabase). Project root `opencode.json` contains only chrome-devtools MCP. No `.opencode/` dir in project; no `agent/` dir in global config. |
| E9 | Config schema supports pinned agents | customize-opencode skill (authoritative): agents defined in `.opencode/agent/*.md`, `~/.config/opencode/agent/*.md`, or inline `agent:` in opencode.json; `default_agent` option; commands accept `agent:` frontmatter. Schema: https://opencode.ai/config.json |

---

## The Three Programmatic Mechanisms

### 1. One-shot CLI (simplest — recommended for the loop)

```bash
# Run a worker on Nemotron
opencode run "audit file X" --model opencode/nemotron-3-ultra-free

# Run on Big Pickle
opencode run "implement fix" --model opencode/big-pickle

# Continue an existing session with a DIFFERENT model (worker handoff)
opencode run "continue" -s ses_fd2b79058fferSSeK5OcE0QegD --model opencode/big-pickle
```

- `--format json` emits raw JSON events → machine-parseable output for the runner.
- `--dir <path>` controls working directory.
- Exit code reflects failure → usable as gate signal.

### 2. Persistent server + HTTP SDK (for a long-lived orchestrator)

```bash
opencode serve --port 4096   # headless server
```

Then via `@opencode-ai/sdk` (already present at `~/.config/opencode/node_modules/@opencode-ai/sdk`):

```ts
await client.prompt({
  path: { id: sessionId },
  body: {
    parts: [{ type: "text", text: "task..." }],
    model: { providerID: "opencode", modelID: "nemotron-3-ultra-free" },
  },
})
```

Per-request `providerID`/`modelID` (E6) means the orchestrator switches workers mid-session without restarting anything.

### 3. Config-level pinning (declarative)

Define named agents that pin specific models, then select by name:

```markdown
<!-- .opencode/agent/nemotron-worker.md -->
---
description: Fast local worker
mode: primary
model: opencode/nemotron-3-ultra-free
---
Worker instructions here.
```

```bash
opencode run "task" --agent nemotron-worker
```

Note: config loads once at startup; no hot-reload.

---

## What "/agents" Actually Is

The TUI's `/agents` command lists *agents* (build, plan, subagents). Switching between Nemotron and Big Pickle in the TUI is the *model selector* (Tab / model picker). Both are surfaced in similar UIs, which explains the conflation. For the Engineering Loop this distinction matters: the loop needs `--model`, not `--agent`.

---

## Safety Considerations for Automation

1. **Permissions**: current permission set allows `question` (mixed allow/deny patterns observed in `opencode agent list` output). Headless runs must not hang on prompts — use explicit permission config or `--auto` (flagged dangerous by OpenCode itself; avoid).
2. **Scope**: `run` executes with full tool access like the TUI. Constrain workers via dedicated agent markdown files with restricted permissions rather than trusting the model.
3. **Cost/quota**: `opencode/big-*` and `*-free` models route through the `opencode` provider account (`auth.json`); token usage visible via `opencode stats`.
4. **Concurrency**: multiple `opencode run` processes can coexist (random port each); a persistent `serve` instance serializes through one server — validate concurrency behavior before building parallel worker pools.

## Limitations

- Model switch applies per-invocation or per-request; there is no "switch model inside a running TUI session from outside" beyond attaching (`opencode attach`) or continuing sessions with new flags.
- No hot-reload: agent/model definition changes require process restart.
- Windows environment: shell quirks apply when scripting around the CLI (PowerShell, no POSIX redirects).
- Version drift: flags verified against 1.18.21; re-verify after upgrades.

---

## Recommendation for MIA Engineering Loop

Wire worker routing directly onto Mechanism 1:

```
subaru revive → classify step → pick model by rule
  → opencode run "<step prompt>" -s <checkpoint session> --model <chosen> --format json
  → parse exit code / JSON events → mark | block | escalate (switch model, same session)
```

This closes the loop audit's biggest gap (Worker Integration score 15/100) using zero new infrastructure: the "Nemotron/Big Pickle router" becomes a ~20-line mapping in the minimal runner, replacing the human typing in the TUI.

---

*Audit performed under Evidence First protocol (ADR-011). All claims cite command output or file paths inspected at HEAD on 2026-08-23.*
