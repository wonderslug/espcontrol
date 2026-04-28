---
name: pr-review
description: >-
  Review a newly submitted or open GitHub pull request for this repository,
  document what changed, evaluate code quality, security and integration risk,
  run the relevant local checks, and recommend whether to merge, request
  improvements, or hold. Use when the user says "/pr-review", "review this
  PR", "new PR", "PR submitted", "check pull request", "outside PR",
  "evaluate PR quality", "should we merge this", or asks for integration
  recommendations on a pull request.
---

# /pr-review

## Overview

Assess a pull request before it is merged. Produce a plain-English summary of
the change, a code-review quality assessment, test results, and a clear
recommendation.

Default to review only. Do not merge, close issues, or push changes unless the
user explicitly asks.

## Workflow

### 1. Resolve the PR

Use the PR number or URL if the user provides one. Otherwise inspect open PRs
and pick the newest one, making that assumption explicit.

```bash
gh pr list --state open --limit 10 \
  --json number,title,author,createdAt,updatedAt,isCrossRepository,headRefName,baseRefName,url
gh pr view <number> \
  --json number,title,author,body,baseRefName,headRefName,isCrossRepository,files,commits,mergeStateStatus,statusCheckRollup,reviews,url
gh pr diff <number> --name-only
gh pr diff <number> --patch
```

Record:

- PR title, author, URL, base branch, and whether it comes from a fork
- Files changed and size of the diff
- Whether it touches firmware, generated assets, docs, workflows, dependency
  files, or release/update paths
- Existing CI state, but do not rely on CI alone

### 2. Protect the Working Tree

Check local status before checkout or tests.

```bash
git status --short --branch
```

If there are unrelated local changes, do not overwrite or revert them. Prefer
reviewing with `gh pr diff` without checkout. If local tests require checkout,
explain that existing worktree changes may block a clean test and ask before
changing branches.

### 3. Understand the Change

Read the PR description, changed files, and relevant surrounding code. For
generated or minified files, inspect the source that produced them first, then
confirm generated output is in sync.

Classify the PR:

- **Docs only:** clarity, accuracy, links, and site build
- **Web UI:** state handling, escaping, generated webserver output, config
  serialization, mobile/desktop layout risk
- **Firmware YAML:** ESPHome schema, substitutions, includes, device coverage,
  generated slot wiring
- **C++ component:** memory lifetime, bounds checks, LVGL object lifetime,
  Home Assistant service calls, compile risk
- **Icons/fonts/timezones:** generated assets, glyph coverage, validation
  scripts
- **CI/release/dependencies:** permissions, secrets, third-party actions,
  lockfile integrity, update/release behavior

### 4. Review Quality and Risk

Use a code-review stance. Prioritize bugs, regressions, security issues,
maintainability problems, and missing tests. Keep style-only comments out unless
they affect readability or future changes.

Check especially for:

- Hidden network calls, new external URLs, branch-based dependencies, or remote
  scripts
- GitHub Actions permission changes, new secrets use, or unpinned third-party
  actions
- Any change that affects firmware update manifests, OTA behavior, release
  assets, or GitHub Pages web UI delivery
- Unsafe parsing, unchecked indexes, buffer sizing, object lifetime, or string
  escaping
- New config formats that are not backward compatible
- Generated files that were edited manually or are stale
- Missing docs for user-facing behavior

### 5. Run Relevant Checks

Run focused checks based on touched files. If a check is skipped, explain why.

Common checks:

```bash
npm run check:config
python3 scripts/build.py --check
python3 scripts/generate_device_slots.py --check
python3 scripts/check_icon_groups.py
python3 scripts/check_timezones.py
npm run docs:build
npm audit --json
```

Use the `compile` skill when firmware, common YAML, device YAML, or C++ changes
could affect firmware builds and the user wants merge-level confidence.

### 6. Recommendation

Choose one recommendation:

- **Merge / integrate:** The change is understandable, scoped, and checks pass.
- **Merge after small fixes:** The PR is sound but has specific minor issues.
- **Request changes:** There are clear bugs, stale generated files, missing
  tests, or documentation gaps.
- **Hold:** Security, release, dependency, or firmware risk needs maintainer
  decision before integration.

Never close linked issues during this workflow. The repo owner wants to test
before issues are closed.

## Output Format

Lead with findings if there are bugs or risks. Keep the explanation approachable
for a technical non-developer.

Use this structure:

```text
Recommendation: <merge / merge after fixes / request changes / hold>

What changed:
- <plain-English summary>

Findings:
- <severity, file/line, issue, impact, suggested fix>

Quality notes:
- <maintainability, fit with repo patterns, tests/docs>

Checks run:
- <command>: <pass/fail/skipped and why>

Questions or decisions:
- <only if needed>
```

If there are no findings, say that clearly and mention any remaining test gaps
or residual risk.
