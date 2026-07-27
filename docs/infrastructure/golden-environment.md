# Golden Environment — MIA Platform

## What is the Golden Baseline?

The Golden Baseline is the **official reference** for the ideal MIA Platform development environment. It represents the exact state that every developer should have when working on the project.

**Key principle**: The Golden Baseline is not about a specific machine — it's about the environment itself. Machine information (`createdOn`) is historical metadata only.

## When to Use

| Scenario | Command | Description |
|----------|---------|-------------|
| New machine setup | `npm run setup-machine` | Automatically compares against Golden Baseline |
| Quick validation | `npm run doctor --compare` | Read-only comparison with compatibility % |
| Create/update baseline | `npm run doctor --create-baseline` | Captures current state as new baseline |
| Update baseline | `npm run doctor --update-baseline` | Updates baseline (requires confirmation) |

## Commands

### `npm run doctor --create-baseline`

Captures the current environment as the new Golden Baseline.

**Preconditions**: Lint, build, and Playwright tests must all pass first.

```bash
# Validate before capturing
npm run lint && npm run build && npm test

# Capture baseline
npm run doctor --create-baseline
```

**What it captures**:
- Runtime versions (Node.js, npm, Git)
- Environment fingerprint (package hashes, versions, OS)
- Tool installations (OpenCode, Playwright, Chrome DevTools MCP)
- Project versions (Next.js, React, TypeScript, ESLint)
- Validation results (lint, build, Playwright status)

### `npm run doctor --compare`

Compares the current environment against the Golden Baseline without modifying anything.

```bash
npm run doctor --compare
```

**Output**:
- Fingerprint comparison (package hashes, versions)
- Runtime version comparison
- Tool availability check
- Compatibility percentage
- Drift summary (None/Minor/Moderate/Major)

### `npm run doctor --update-baseline`

Updates the Golden Baseline to the current environment state.

```bash
# Always shows what will change first
npm run doctor --update-baseline
```

**Security**:
- Requires explicit confirmation (`y/N`)
- Creates backup before updating
- Writes history entry

## Architecture

```
.infrastructure/
├── baseline.json              # Golden Baseline (ideal environment)
├── profiles/
│   └── developer.json         # Development profile
└── history/                   # Review history
    ├── YYYY-MM-DD-HHmm-check.json
    ├── YYYY-MM-DD-HHmm-baseline-created.json
    └── YYYY-MM-DD-HHmm-baseline-updated.json
```

## Environment Fingerprint

The fingerprint detects differences between the current machine and the Golden Baseline.

| Component | Purpose | Source |
|-----------|---------|--------|
| `packageJsonHash` | Detects dependency changes | `sha256:package.json` |
| `packageLockHash` | Detects lock file changes | `sha256:package-lock.json` |
| `nodeVersion` | Detects Node.js version drift | `node --version` |
| `npmVersion` | Detects npm version drift | `npm --version` |
| `gitVersion` | Detects git version drift | `git --version` |
| `osFamily` | Detects OS differences | `process.platform` |

## Drift Classification

| Level | Meaning | Example | Action |
|-------|---------|---------|--------|
| **None** | Matches baseline | Same versions, same hashes | No action |
| **Minor** | Cosmetic difference | Version patch, build time variance | Log only |
| **Moderate** | Notable difference | New package, significant time change | Warn and track |
| **Major** | Critical difference | Missing package, build failure | Block and remediate |

## Integration with Bootstrap

When running `npm run setup-machine`, Bootstrap automatically:

1. Reads the Golden Baseline
2. Computes current environment fingerprint
3. Displays comparison table
4. Shows compatibility percentage
5. Recommends actions based on drift level

## Security Rules

| Rule | Description |
|------|-------------|
| **No secrets** | Never store API keys, tokens, or passwords. Only variable names. |
| **No auto-update** | `--update-baseline` always requires explicit confirmation. |
| **Always backup** | Before any update, backup current baseline to `history/`. |
| **Validation first** | `--create-baseline` only succeeds if all quality gates pass. |
| **Audit trail** | Every operation creates a history entry with timestamp. |

## Golden Baseline vs Regular Baseline

| Aspect | Regular Baseline | Golden Baseline |
|--------|------------------|-----------------|
| **Purpose** | Snapshot of healthy state | Official reference for ideal environment |
| **Authority** | "This machine works" | "All machines should work like this" |
| **Updates** | Periodic snapshots | Explicit `--create-baseline` or `--update-baseline` |
| **Metadata** | Minimal | Full fingerprint, machine info, validation status |

## Example Workflow

### New Developer Onboarding

```bash
# 1. Clone repository
git clone https://github.com/arbojo/mia-platform.git
cd mia-platform

# 2. Compare against Golden Baseline
npm run doctor --compare

# 3. See what's missing
# Output: Compatibility: 65% (15/25 checks match)

# 4. Run setup machine
npm run setup-machine

# 5. Verify setup
npm run doctor --compare
# Output: Compatibility: 100% (25/25 checks match)
```

### Periodic Validation

```bash
# Quick check against Golden Baseline
npm run doctor --compare

# Output:
# Compatibility: 96% (24/25 checks match)
# Drift: Minor (1 dependency count changed)
# Status: ✅ COMPATIBLE
```

### Updating the Baseline

```bash
# After intentional changes (new dependency, version upgrade)
npm run doctor --update-baseline

# Output:
# Current baseline: Created 2026-07-26 on HP-David
# Changes detected:
#   - node_modules: 850 → 852 (+2 dependencies)
#   - TypeScript: 5.8.3 → 5.9.0
#
# Update baseline? (y/N): y
#
# Baseline updated. History saved.
```

## Troubleshooting

### Baseline Not Found

```bash
# Error: Golden Baseline not found
# Run --create-baseline first
npm run doctor --create-baseline
```

### Low Compatibility

```bash
# Check what's different
npm run doctor --compare

# Common issues:
# - Missing npm dependencies → npm install
# - Missing Playwright browsers → npx playwright install chromium
# - Version drift → npm update (check compatibility first)
```

### Fingerprint Mismatch

```bash
# Package hash differs → dependencies changed
npm ls --depth=0  # Check what changed

# Lock file hash differs → lock file changed
git diff package-lock.json  # Review changes
```
