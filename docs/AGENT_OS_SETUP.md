# DK-LiveDemo Agent OS — Phased Setup Prompts for Claude Code

## Why the original prompt was timing out

The original prompt asked Claude Code to do everything in one turn:

- Walk the entire repo tree
- Read `package.json` and every relevant subfolder
- Connect to the AA Portal DB MCP, list every schema, every table, every column, every FK
- Decide which agents to create
- Write 15+ files (CLAUDE.md, AGENTS.md, 7+ Cursor rules, 6+ Claude subagents, 4 skills, settings.json, README, scaffolding)
- Produce a final summary

That's 30+ tool calls and a lot of token-heavy file writes in a single stream. Two things kill it:

1. **Stream idle timeout** — Claude Code's HTTP stream expects regular output. A long sequential chain of tool calls without text between them can stall the connection.
2. **Context bloat** — every file read and DB result accumulates. By the time it's writing the 12th agent file, the context is huge and each token gets slower, which makes the timeout more likely.

## The fix: 7 phases with file-based handoffs

Each phase writes its output to disk. The next phase reads those files instead of redoing the work. Between phases, run `git add -A && git commit -m "phase N: <name>"` so you have rollback points.

**Run each prompt as a fresh Claude Code session** (or `/clear` between them). That keeps each turn's context small and lets you retry a single phase if it stumbles, without losing the work from earlier phases.

---

## Phase 0 — One-time setup (run once, manually)

Before Phase 1, in the repo root:

```bash
mkdir -p docs/agent-reports docs/architecture docs/qa docs/security
mkdir -p .cursor/rules .cursor/plans
mkdir -p .claude/agents .claude/skills
touch .cursor/plans/.gitkeep docs/architecture/.gitkeep docs/qa/.gitkeep docs/security/.gitkeep
git add -A && git commit -m "phase 0: scaffold agent OS folders"
```

This way Claude Code never has to mkdir; it just writes files into existing folders.

---

## Phase 1 — Inspection only (read-only, writes one report)

**Goal:** produce `docs/agent-reports/INSPECTION_REPORT.md`. Nothing else.

```
You are setting up an AI Agent OS for the DK-Livedemo repo (Matty Herrera, Delta
Kinetics, Houston TX). This is Phase 1 of a 7-phase plan. Your ONLY job in this
phase is to inspect the repo + database and write a single report file.

DO NOT create CLAUDE.md, AGENTS.md, .cursor/, .claude/, or any other agent files
in this phase. Only write docs/agent-reports/INSPECTION_REPORT.md.

Use a TodoWrite list to track these steps:

1. Read the repo tree (top 3 levels). Note what folders exist.
2. Read package.json (or pyproject.toml, go.mod, Cargo.toml, etc.) and list:
   - language, framework, package manager
   - all scripts
   - all runtime dependencies
   - all dev dependencies
3. Identify existing structure: routes, API handlers, DB clients, auth, middleware,
   components, pages. Quote the actual paths.
4. Check for prior agent files: CLAUDE.md, AGENTS.md, .cursor/, .claude/, docs/.
   If any exist, read them and quote what's there.
5. Connect to the AA Portal DB MCP server. Run:
   - list_schemas
   - list_objects for each schema (limit to non-system schemas)
   - get_object_details on every table
   For each table capture: name, purpose (inferred from name + columns), columns
   (name, type, nullability), primary key, foreign keys, RLS-looking patterns.
6. Identify auth/user/role/permission tables specifically.
7. Write a brief analysis: what the portal does, who uses it, core entities,
   main workflows, tech patterns, risks/gaps.

Write everything into docs/agent-reports/INSPECTION_REPORT.md with these sections:

  # DK-Livedemo Inspection Report
  ## Repo Structure
  ## Tech Stack
  ## Scripts
  ## Dependencies
  ## Existing Code Patterns
  ## Existing Agent Files (if any)
  ## Database Schema
    ### Schema: <name>
      #### Table: <name>
        - Purpose: ...
        - Columns: ...
        - PK / FKs: ...
  ## Auth & Permissions Model
  ## Inferred Purpose & Workflows
  ## Risks & Gaps

When the report is written, output a 5-line summary of what you found and STOP.
Do not start Phase 2.
```

After it finishes:

```bash
git add docs/agent-reports/INSPECTION_REPORT.md
git commit -m "phase 1: inspection report"
```

---

## Phase 2 — Agent selection plan

**Goal:** produce `docs/agent-reports/AGENT_PLAN.md`.

```
You are continuing setup of the DK-Livedemo Agent OS. Phase 1 is done.

Read docs/agent-reports/INSPECTION_REPORT.md fully before doing anything else.

Your only job in Phase 2 is to write docs/agent-reports/AGENT_PLAN.md.

The baseline agents (always required) are:
  - Project Standards
  - Security Reviewer
  - API / Schema Architect
  - QA Tester
  - DevOps / Deployment
  - Docs Writer

Decide whether to ALSO include each of these, with reasoning grounded in the
inspection report:
  - Frontend Builder (only if there is a UI layer)
  - Database Agent (if schema is complex or has RLS / permissions)
  - Auth & Roles Agent (if there is auth or RBAC)
  - Any other specialized agent the codebase warrants

Write AGENT_PLAN.md with these sections:

  # DK-Livedemo Agent OS — Plan
  ## Agents Included (with one-paragraph justification each)
  ## Agents Excluded (with reason)
  ## File Map (every file that will be created in Phases 3–7, with full path)
  ## Open Questions for Matty (anything you couldn't decide from inspection alone)

Do not create any other files in this phase. When AGENT_PLAN.md is written,
output a 3-line summary and STOP.
```

```bash
git add docs/agent-reports/AGENT_PLAN.md
git commit -m "phase 2: agent plan"
```

---

## Phase 3 — Foundation memory files

**Goal:** create `CLAUDE.md` and `AGENTS.md` only.

```
You are continuing setup of the DK-Livedemo Agent OS. Phases 1–2 are done.

Read these first, in order:
  1. docs/agent-reports/INSPECTION_REPORT.md
  2. docs/agent-reports/AGENT_PLAN.md

In Phase 3, create exactly two files: CLAUDE.md and AGENTS.md.

CLAUDE.md must include, with content drawn from the inspection report:
  - What this portal does
  - Exact tech stack
  - All available scripts
  - Database summary: every table, its purpose, key relationships
  - Supabase project ID (if Supabase is in use): hyeislkhqkkcveqqbwix
    Note carefully: this is "double-k" — never write hyeislkhqkvcveqqbwix.
  - Deployment targets: Railway for backends, Vercel for frontends
  - Secrets rule: ALL secrets come from Infisical (self-hosted on Railway).
    Never hardcoded. Never real values in .env files.
  - Agent OS section explaining the .claude/ and .cursor/ structure
  - Coding standards: follow existing patterns; no new dependencies without
    flagging; TypeScript preferred in TS repos
  - Any repo-specific rules surfaced during inspection

AGENTS.md must include:
  - Plain-English description of the portal
  - Owner: Matty Herrera, Delta Kinetics, Houston TX
  - Non-negotiable rules for any AI agent in this repo
  - Summary of every agent role from AGENT_PLAN.md
  - How to invoke Cursor rules
  - How to invoke Claude subagents and skills
  - Stack summary

Do not create any other files in this phase. When both files are written,
output a 3-line summary and STOP.
```

```bash
git add CLAUDE.md AGENTS.md
git commit -m "phase 3: CLAUDE.md and AGENTS.md"
```

---

## Phase 4a — Cursor rules, batch 1

**Goal:** create the first half of `.cursor/rules/`.

```
You are continuing setup of the DK-Livedemo Agent OS. Phases 1–3 are done.

Read INSPECTION_REPORT.md, AGENT_PLAN.md, and CLAUDE.md before writing.

In Phase 4a, create exactly these files:
  .cursor/rules/00-project-standards.mdc
  .cursor/rules/10-security-reviewer.mdc
  .cursor/rules/20-api-schema-architect.mdc

Every .mdc file must have:
  - Valid frontmatter (description + globs OR alwaysApply)
  - The agent's specific role and scope
  - What it should check / review (using ACTUAL table names, route paths, and
    tech choices from the inspection report — no generic placeholders)
  - What it must never do
  - Expected output format and where reports go
  - Repo-specific knowledge

00-project-standards.mdc should be alwaysApply: true. The other two should be
scoped with appropriate globs (e.g. API rule applies to API/route folders;
security rule applies broadly).

When all three files are written, output a 3-line summary and STOP. Do not
write any other rules — those come in Phase 4b.
```

```bash
git add .cursor/rules/
git commit -m "phase 4a: cursor rules batch 1"
```

---

## Phase 4b — Cursor rules, batch 2

```
Continuing DK-Livedemo Agent OS setup. Phases 1–4a are done.

Read INSPECTION_REPORT.md and AGENT_PLAN.md.

In Phase 4b, create the remaining .cursor/rules/*.mdc files according to
AGENT_PLAN.md. At minimum these:
  .cursor/rules/40-qa-tester.mdc
  .cursor/rules/50-devops-deployment.mdc
  .cursor/rules/60-docs-writer.mdc

Plus, only if AGENT_PLAN.md included them:
  .cursor/rules/30-frontend-builder.mdc        (only if UI exists)
  .cursor/rules/70-database.mdc                (if database agent included)
  .cursor/rules/80-auth-roles.mdc              (if auth agent included)
  any additional rules listed in AGENT_PLAN.md

Same content requirements as Phase 4a: real frontmatter, real repo specifics,
explicit do-not-do list, output format, and where reports land.

When done, output a 3-line summary and STOP.
```

```bash
git add .cursor/rules/
git commit -m "phase 4b: cursor rules batch 2"
```

---

## Phase 5 — Claude subagents

**Goal:** create everything under `.claude/agents/`.

```
Continuing DK-Livedemo Agent OS setup. Phases 1–4 are done.

Read INSPECTION_REPORT.md and AGENT_PLAN.md.

In Phase 5, create one .md file per agent listed in AGENT_PLAN.md, under
.claude/agents/. The baseline set:

  .claude/agents/security-reviewer.md
  .claude/agents/api-schema-architect.md
  .claude/agents/qa-tester.md
  .claude/agents/devops-deployment.md
  .claude/agents/docs-writer.md

Plus any conditional agents from AGENT_PLAN.md (frontend-builder.md,
database-agent.md, auth-roles.md, etc.).

Each file must have:
  - YAML frontmatter: name, description, and any other supported fields
    (model, tools — leave tools unset unless the plan requires restriction)
  - Role definition
  - Specific responsibilities tied to this repo's actual codebase
    (real table names, real routes, real frameworks — pull from the report)
  - What this agent must never do or touch
  - Step-by-step workflow
  - Output format and file naming convention for reports
    (e.g. docs/security/SEC-YYYY-MM-DD-<topic>.md)

To keep this phase under the timeout, write the agents in two passes:
  Pass 1: security-reviewer, api-schema-architect, qa-tester
  Pass 2: devops-deployment, docs-writer, plus any conditional agents

After Pass 1, output a one-line "pass 1 complete" note and continue to Pass 2
in the same turn. After Pass 2, output a 3-line summary of all agents created
and STOP.

If you sense the turn is getting long, stop after Pass 1, output what you've
done, and tell me to run a Phase 5b prompt for the rest.
```

```bash
git add .claude/agents/
git commit -m "phase 5: claude subagents"
```

---

## Phase 6 — Claude skills

**Goal:** create the four SKILL.md files.

```
Continuing DK-Livedemo Agent OS setup. Phases 1–5 are done.

Read INSPECTION_REPORT.md and AGENT_PLAN.md.

In Phase 6, create exactly these files:

  .claude/skills/security-audit/SKILL.md
  .claude/skills/feature-build/SKILL.md
  .claude/skills/bug-sweep/SKILL.md
  .claude/skills/release-check/SKILL.md

Each SKILL.md must include:
  - Purpose
  - Numbered, step-by-step procedure (not vague)
  - Checklist items
  - Output requirements: exact file path to produce, format, where to save it
  - Pass/fail criteria

Use real specifics from the inspection report — actual table names in the
security-audit checklist, actual deployment targets in release-check, etc.

When all four are written, output a 3-line summary and STOP.
```

```bash
git add .claude/skills/
git commit -m "phase 6: claude skills"
```

---

## Phase 7 — Settings, README, final summary

**Goal:** finish the system and produce the final report.

```
Final phase of DK-Livedemo Agent OS setup.

Read INSPECTION_REPORT.md, AGENT_PLAN.md, and CLAUDE.md.

In Phase 7, create exactly these files:

  .claude/settings.json
  docs/agent-reports/AGENT_SYSTEM_README.md

settings.json requirements:
  - Conservative. Do not enable anything destructive.
  - If you are unsure about a setting, leave it out.
  - Note every omission in AGENT_SYSTEM_README.md under an "Intentional
    Omissions" section.

AGENT_SYSTEM_README.md requirements:
  - Plain-English overview of the agent system
  - What each folder does (.cursor/, .claude/, docs/)
  - Difference between a Cursor rule, a Claude subagent, and a Claude skill
  - Day-to-day usage guide
  - Example prompts for invoking each agent
  - Recommended workflow: Plan → Build → Review → Test → Fix → Document → Release
  - Intentional Omissions section (anything left out of settings.json with reason)
  - Open Questions for Matty (anything you assumed or couldn't decide)

Then, in your final response message (not in a file), produce the FINAL SUMMARY:

  1. What this portal does
  2. Database schema summary (all tables found)
  3. Full list of files created across all 7 phases
  4. Which agents were created and why
  5. Which agents were NOT created and why
  6. Risks, gaps, or issues noticed during inspection
  7. Assumptions you made
  8. What Matty needs to review or complete manually
  9. Recommended first task to run with this agent system

STOP after the summary. Do not modify any other files.
```

```bash
git add -A
git commit -m "phase 7: settings, README, complete agent OS"
```

---

## General tips for every phase

- **Start each phase as a fresh session** (or `/clear`). The previous phase's work is on disk; you don't need its context buffered in memory.
- **If a phase still times out**, split it further. For example, if Phase 4b is too big, run it once for `40-qa-tester.mdc + 50-devops-deployment.mdc`, then again for the rest.
- **Don't let Claude Code re-inspect.** If it starts re-reading the repo tree or re-querying the DB in Phase 3+, stop it and remind it to read INSPECTION_REPORT.md instead.
- **Watch the TodoWrite list.** If it has more than ~6 items in a single phase, the phase is too big.
- **Commit between phases.** Cheap insurance and gives you an obvious rollback point if a later phase produces something off.
- **Use `--resume` only within a phase**, not across phases. Each phase should start clean.

## If a phase fails midway

The git commits make this safe. Either:

- Re-run the same phase prompt (idempotent for files; Claude Code will overwrite)
- Or `git reset --hard <last-good-commit>` and re-run

## Phases that are most likely to need splitting

Based on size, watch these:

- **Phase 1** — large DB schema. If the AA Portal DB has >20 tables, split the schema dump into 1a (schemas + table list) and 1b (per-table details).
- **Phase 5** — many agent files. Already split into two passes; split further if needed.
- **Phase 4b** — varies based on how many conditional rules AGENT_PLAN.md adds.
