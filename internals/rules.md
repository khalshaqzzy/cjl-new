# Internals Rules

Document status: Active  
Created: 2026-03-19  
Purpose: operating rules for Codex when reading or updating the `internals/` directory

## 1. Why This Folder Exists

The `internals/` folder is the project memory and execution layer for CJ Laundry.

It exists to:

- preserve product and implementation intent across sessions
- prevent re-planning work that is already decided
- keep future sessions aligned with the current repo state
- record what was completed, what is next, and where to start

If code changes materially affect roadmap, deployment, scope, or recommended next steps, `internals/` should usually be updated in the same session.

## 2. File Roles

## 2.1 Product and design source of truth

Read these first when behavior or scope is unclear:

- `PRD.md`
  - product contract
  - business rules
  - expected user behavior

There are currently no dedicated `adminFrontendDesign.md` or `publicFrontendDesign.md` files in `internals/`.

Until those exist, treat:

- `PRD.md`
- the latest relevant handoff file
- existing admin/public implementation in the repo
- relevant ADRs under `docs/adr/`

as the practical design-intent source of truth.

## 2.2 Execution and planning source of truth

Read these before planning or continuing implementation:

- `implementationPhases.md`
  - master roadmap
  - current repo progress snapshot
  - cross-phase sequencing
- `phaseBacklog.md`
  - condensed actionable backlog
  - next recommended items
- `environmentMatrix.md`
  - local/staging/production topology
- `deploymentGuide.md`
  - canonical deployment, provisioning, secrets, rollback, and smoke-test runbook
- `releaseExecutionChecklist.md`
  - operator checklist for live staging and production rollout windows
- `manualProvisioningChecklist.md`
  - short external provisioning checklist
- `productionReadinessChecklist.md`
  - final pre-prod and pre-main release gate

These should be updated whenever implementation changes alter roadmap status, environment assumptions, or deployment/provisioning requirements.

## 2.3 Session continuity files

Use these to resume work efficiently:

- `sessionHandoff-YYYY-MM-DD.md`
  - high-signal snapshot of what the last major session completed
  - verification run
  - repo facts and next recommended start
- `whatsappBusinessApiMigrationPhases.md`
  - migration-specific execution plan for Cloud API / webhook / inbox work
  - the canonical phase-by-phase sequence for WhatsApp platform migration

If a future session creates a dedicated `phase{N}Kickoff.md`, treat it as a phase-specific starter. Until then, use the newest handoff plus the relevant roadmap doc instead of assuming a kickoff file already exists.

## 2.4 Traceability and support docs

- `phaseBacklog.md`
  - short execution inventory
- `docs/adr/`
  - accepted architecture decisions
  - frozen runtime, contract, and topology choices future sessions should not silently re-decide

If a dedicated requirement traceability matrix is added later, treat it as the first stop for PRD-to-code coverage checks. Until then, use `PRD.md`, `implementationPhases.md`, `phaseBacklog.md`, and the relevant ADRs together for traceability.

Update these when requirement-to-implementation mapping changes or when the recommended next work changes materially.

## 2.5 Architecture decision records

Use `docs/adr/` when a session makes or materially changes a long-lived technical decision.

Typical ADR-worthy changes include:

- contract shape changes that affect multiple apps or future phases
- runtime topology decisions such as workers, queues, storage, or provider boundaries
- deployment or operational architecture decisions that future sessions must preserve
- a phase-level implementation choice that intentionally narrows future options

ADR files should:

- use the next sequential `000N-...` filename
- state status, date, and decision scope near the top
- separate context, decision, rationale, consequences, and follow-up clearly
- describe the decision, not just the code diff

If a session changes an existing accepted architecture decision, update the affected ADR or add a superseding ADR in the same session.

## 3. Recommended Read Order For Future Sessions

For most implementation sessions, read in this order:

1. `internals/rules.md`
2. the newest `internals/sessionHandoff-YYYY-MM-DD.md`
3. `internals/implementationPhases.md`
4. `internals/phaseBacklog.md`
5. `internals/whatsappBusinessApiMigrationPhases.md` when the session touches WhatsApp migration, Cloud API, webhook, inbox, or template work
6. `internals/deploymentGuide.md` if the session touches environments, secrets, deploys, VMs, Vercel, or Firebase
7. `internals/releaseExecutionChecklist.md` if the session is preparing or guiding a live rollout
8. `internals/PRD.md` if product behavior is involved
9. relevant `docs/adr/` entries when the task touches architecture, contracts, runtime behavior, or deployment shape

## 4. When To Update Existing Files

Update an existing `internals` file when:

- a phase changes from pending to complete in repo terms
- the recommended next phase or next session start changes
- a deploy workflow, secret list, runtime path, domain, or environment assumption changes
- the canonical source-of-truth file for a topic changes
- a previous handoff is now stale for the current repo state
- roadmap status changes but the file's original purpose is still the same

Update or add an ADR when:

- a long-lived architecture decision was made during the session
- an accepted technical decision changed in a way future sessions must know
- code now implements a previously planned architecture choice and the decision should be frozen in repo memory

Examples:

- phase 4 or 5 implementation finished:
  - update `implementationPhases.md`
  - update `phaseBacklog.md`
  - update the current handoff file
- deployment env templates or GitHub secrets changed:
  - update `deploymentGuide.md`
  - update `manualProvisioningChecklist.md`
  - update `environmentMatrix.md` if topology changed
- a new worker, provider boundary, or storage lifecycle became part of the architecture:
  - add or update a `docs/adr/` entry

## 5. When To Add A New File

Add a new file in `internals/` when:

- a new phase needs a dedicated kickoff/start document
- a major session materially changes the repo and needs a fresh handoff
- a new category of long-lived operational knowledge appears and does not fit an existing file cleanly
- a new canonical runbook is needed for a distinct area
- adding the content to an existing file would make that file confusing or overload its purpose

Examples:

- starting phase 7:
  - add `phase7Kickoff.md`
- after a large session that changes the recommended next start:
  - add a new dated `sessionHandoff-YYYY-MM-DD.md`
- if observability or security hardening gets large enough:
  - add a focused runbook instead of overloading `deploymentGuide.md`

## 6. When Not To Add A New File

Do not add a new file when:

- the information is only a minor status update to an existing roadmap or handoff
- the content belongs naturally in `deploymentGuide.md`, `implementationPhases.md`, or `phaseBacklog.md`
- the new file would duplicate information already documented elsewhere
- the change is temporary scratch work that will not help future sessions

Default to updating an existing file unless there is a clear reason to split.

## 7. Naming Rules

Use these patterns:

- `sessionHandoff-YYYY-MM-DD.md`
- `phase{N}Kickoff.md`
- descriptive long-lived docs in `camelCase.md` only when they represent a stable concept already used in this folder
- ADRs in `docs/adr/` should use `000N-kebab-case-title.md`

New files should have:

- a one-line purpose near the top
- document status
- creation date
- enough context for a future session to use the file without rereading unrelated files first

## 8. Commit Message Rules

Use a conventional prefix for new commit messages. The subject must start with a lowercase type followed by a colon and a space.

Preferred types:

- `feat:` for user-visible features or new capabilities
- `fix:` for bug fixes, regressions, security fixes, and broken behavior
- `chore:` for maintenance, dependency updates, tooling, repo hygiene, or generated updates
- `docs:` for documentation-only changes
- `test:` for test-only changes
- `refactor:` for behavior-preserving code restructuring
- `perf:` for performance improvements
- `ci:` for GitHub Actions, deploy pipeline, and automation changes
- `build:` for build system, packaging, Dockerfile, or artifact changes

Subject rules:

- write in imperative mood, for example `fix: sort dashboard customers by earned points`
- keep the subject concise and specific, ideally 72 characters or fewer
- do not end the subject with a period
- use a body when the reason, migration impact, or operational caveat is not obvious from the subject
- prefer one logical change per commit; split unrelated runtime, docs, and deployment changes when practical

If a change spans multiple categories, choose the prefix that best describes the user-visible or operational effect. For example, a code change with tests should usually be `feat:` or `fix:`, not `test:`.

## 9. Content Rules

When updating or adding files in `internals/`:

- write for future Codex sessions, not for marketing or external users
- optimize for high-signal continuity
- keep absolute product facts and current repo facts separate
- state whether something is complete in repo terms or still requires external provisioning
- call out frozen decisions that must not be re-decided
- note important caveats that can save a future session from bad assumptions

When updating or adding ADRs:

- explain the durable technical decision and why it was chosen
- capture tradeoffs and operational caveats, not just happy-path outcomes
- note follow-up work if the decision intentionally defers later improvements

## 10. Verification Rules

Before declaring an implementation, dependency, deployment, or security-sensitive change complete, verify against the same gates used by the GitHub CI workflows, not only the commands directly related to the edited file.

Use `.github/workflows/ci.yml`, `.github/workflows/codeql.yml`, `.github/workflows/dependency-review.yml`, and root `package.json` as the canonical source for the current verification list. If those files change, update this section in the same session.

Local verification for code changes should include, in this order:

1. `npm run lint`
2. `npm run typecheck`
3. `npm run validate:cloud-runtime`
4. `npm run audit:prod`
5. `npm test`
6. `npm run build`

CI also runs `docker compose config` and `docker compose build`, but these are not required for local verification because they will run in the pipeline.

Security and supply-chain CI gates must also be accounted for, but are also not required for local verification:

- CI runs Gitleaks through `gitleaks/gitleaks-action@v2`.
- CI runs Trivy filesystem scan through `aquasecurity/trivy-action` with `scan-type=fs`, `ignore-unfixed=true`, and severities `HIGH,CRITICAL`.
- CodeQL runs on `javascript-typescript` after `npm ci` and `npm run build`.
- Dependency Review runs on pull requests through `actions/dependency-review-action@v4`.

For small documentation-only changes that do not affect runtime code, dependency metadata, deploy behavior, or security posture, a lighter verification pass is acceptable. Still report what was run and why the full CI-equivalent suite was not necessary.

Do not describe work as fully verified unless every applicable command above passed or every skipped gate is explicitly called out with a reason.

## 11. Required Updates After Major Sessions

After a major implementation or deployment-prep session, usually do all of the following:

1. update `implementationPhases.md`
2. update `phaseBacklog.md`
3. update the current handoff file or create a new dated handoff
4. update any affected environment/deployment docs
5. add the next phase kickoff file if the next session start is now clear
6. add or update a `docs/adr/` entry if the session introduced or changed a durable architecture decision


If future sessions make these stale, update them before ending the session.
