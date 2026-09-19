# frontdesk (skill)

<sub><a href="README.md">한국어</a> &middot; <a href="README.zh.md">中文</a></sub>

This folder — including [`SKILL.md`](SKILL.md) — is a **self-contained skill package** you can install as-is into another project. For the project's overall background and design docs, see the repo root's [`README.md`](../../README.md) and [`ARCHITECTURE.md`](../../ARCHITECTURE.md).

## Install

```bash
npx skills add TLSRUF/frontdesk@frontdesk
```

Or install directly via the git URL (both forms verified working):

```bash
npx skills add https://github.com/TLSRUF/frontdesk
```

skills.sh has no separate submission/review process — any public repo with a `SKILL.md` is installable this way immediately, and leaderboard visibility appears to follow actual install telemetry (verified against the `vercel-labs/skills` repo; see [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md) for details).

Once installed, Claude will automatically consult this skill in situations like "is there an existing skill/tool for this task?" To check manually:

```bash
node scripts/route.mjs "recommend a testing automation tool"
```

## What's in this folder

- `SKILL.md` — the actual skill definition Claude (or another agent) reads
- `taxonomy.mjs` — the 13-department classification scheme
- `data/catalog.json` — the classified catalog data (1,311 entries)
- `scripts/` — the collect (`collect-*.mjs`) → classify (`classify.mjs`) → enrich (`enrich-descriptions.mjs`) → document (`build-catalog-md.mjs`) → route (`route.mjs`) → benchmark (`benchmark.mjs`) → starter pack (`pick-best-of-breed.mjs`, `install-starter-pack.mjs`) → pipeline (`pipeline.mjs`) pipeline
- `CATALOG.md` — the full human-readable catalog listing
- `BENCHMARK.md` — classification accuracy/false-positive benchmark and a scale comparison against similar projects
- `data/starter-pack.json` — the per-department top-pick list (regenerate with `npm run starter-pack`)
- `data/starter-pack-llm-judge.json` — those 12 picks judged by reading their actual SKILL.md content (includes a real case where the most-installed pick wasn't the best one)

Refresh the catalog with `npm run all`, run the benchmark with `npm run benchmark`, install the starter pack with `node scripts/install-starter-pack.mjs --yes`, run the pipeline with `node scripts/pipeline.mjs "project description"` (see the repo root README).
