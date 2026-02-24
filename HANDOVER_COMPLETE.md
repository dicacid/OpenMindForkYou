# OpenMind v1 — Complete Handover & Build State Document

**Version:** 0.3 | **Date:** 2026-02-24 | **Session:** 7Csi8
**Status:** ACTIVE BUILD — Agent Prompt Template complete. Wrapper validation next.

---

> **⚠️ MANDATORY READING FOR NEW AGENTS**
>
> This document is the single source of truth for OpenMind v1 development. Paste this into every new session. Every agent confirms understanding of locked decisions before proceeding.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architectural Decisions — LOCKED](#2-architectural-decisions--locked)
3. [Core Execution Flow](#3-core-execution-flow)
4. [State Machine](#4-state-machine)
5. [Confidence & Risk Formula](#5-confidence--risk-formula)
6. [Event Schema v0.1 — LOCKED](#6-event-schema-v01--locked)
7. [Module Roles](#7-module-roles)
8. [Open Items](#8-open-items)
9. [Build Order & Current Progress](#9-build-order--current-progress)
10. [Deliverables Completed](#10-deliverables-completed)
11. [Immediate Next Steps](#11-immediate-next-steps)

---

## 1. Project Overview

**OpenMind v1** is a deterministic, auditable, confidence-driven autonomous agent with an event-sourced backbone. It is NOT a conversational AI or general assistant. It is a **task-execution engine** with auditable reasoning built into every state transition.

**Phase 1 Focus:** Rigid event-sourced backbone that guarantees traceability and survives concurrency, offline mode, and failure without CRDTs or optimistic hacks.

**Key Principle:** Single source of truth = append-only immutable event log. No mutation, no branching, no rollback.

---

## 2. Architectural Decisions — LOCKED

These are **non-negotiable** for v1. Do not relitigate without explicit sign-off from Nick Thompson.

| Decision | Rationale | Lock Status |
|----------|-----------|-------------|
| **Event sourcing as core** | Eliminates concurrency bugs. Perfect audit trail by design. | ✅ LOCKED |
| **Fail-forward, no rollback** | Agent annotates failures and replans from annotated state. More realistic than undo. | ✅ LOCKED |
| **Hard schema validation at wrapper** | Agent cannot emit garbage. Rejections are errors that force replanning. | ✅ LOCKED |
| **Rationale >= 50 chars** | Prevents hand-wavy reasoning. Legible decisions mandatory. | ✅ LOCKED |
| **Risk-adjusted thresholds** | threshold = 0.55 + (risk_score × 0.40). Irreversibility scales confidence bar. | ✅ LOCKED |
| **Genesis from outside only** | Agent never bootstraps itself. External input always triggers. | ✅ LOCKED |
| **FALLBACK → always PLAN** | After fallback, always return to PLAN (not conditional IDLE). Keeps task continuity. v1 simplification. | ✅ LOCKED (Item #1 resolved) |

---

## 3. Core Execution Flow

```
Wrapper injects genesis event
         ↓
Agent reads full log, filters by planId
         ↓
Agent emits structured boundary event (rationale >= 50 chars)
         ↓
Wrapper validates against schema
         ├─ ACCEPT: append to log
         ├─ REJECT: emit error event, agent reads error, replans
         └─ Repeat
         ↓
State machine progresses: IDLE → INTAKE → PLAN → EXECUTE → OBSERVE → VALIDATE → (PLAN or TERMINATED)
         ↓
On plan failure: emit plan_abandoned, propose new plan. No rollback.
         ↓
Agent reaches TERMINATED with full audit trail.
```

---

## 4. State Machine

### 4.1 States

| State | Purpose | Key Output |
|-------|---------|-----------|
| **IDLE** | System at rest, awaiting trigger | — |
| **INTAKE** | Normalise and schema-validate incoming task | TaskRepr + BeliefState |
| **PLAN** | Generate ranked plans with confidence + risk | Plan[] with confidences + risk_score |
| **EXECUTE** | Issue actions via tools/actuators | ActionLog + results |
| **OBSERVE** | Capture every outcome (mandatory discrete step) | ObservationRecord + delta_from_expected |
| **VALIDATE** | Critic loop — does outcome match goal? | ValidationScore + trace |
| **FALLBACK** | Safe containment on confidence/rationale failure | FallbackLog + policy execution |
| **TERMINATED** | Clean shutdown or success | Archive bundle (full trace) |

### 4.2 Transition Rules (Summary)

| From | Condition | Action | To |
|------|-----------|--------|-----|
| IDLE | Valid task | Parse & validate | INTAKE |
| INTAKE | Schema valid | Initialise BeliefState | PLAN |
| INTAKE | Schema invalid | — | FALLBACK |
| PLAN | confidence >= threshold | Select top plan | EXECUTE |
| PLAN | confidence < threshold AND risk < 0.4 | Proceed with audit | EXECUTE |
| PLAN | confidence < threshold AND risk >= 0.4 | — | FALLBACK |
| EXECUTE | Success | Request observation | OBSERVE |
| EXECUTE | Tool error/timeout | Emit failure, annotate state | OBSERVE |
| OBSERVE | Any observation | — | VALIDATE |
| VALIDATE | Score >= 0.9 AND goal met | — | TERMINATED |
| VALIDATE | Score >= 0.9 BUT goal not met | Replan | PLAN |
| VALIDATE | Score < 0.9 | — | FALLBACK |
| FALLBACK | Policy executed | Never rollback. Always advance. | PLAN |

### 4.3 Invariants

- No EXECUTE without a Plan signed off by RiskAssessor.
- Every state change emits exactly one structured record **before** transition.
- BeliefState mutated in-place with failure annotations. Never reverted.
- Full trace is append-only. Cryptographic hash-chaining is Phase 2.
- `rationale < 50 characters` → force FALLBACK (hard reject).
- RiskAssessor is pure deterministic code. No LLM touches threshold logic.

---

## 5. Confidence & Risk Formula

### 5.1 Decision Formula

```
risk_adjusted_threshold = 0.55 + (risk_score × 0.40)

Examples:
  risk_score = 0.0  →  threshold = 0.55  (trivial reversible action)
  risk_score = 0.5  →  threshold = 0.75  (moderate risk)
  risk_score = 1.0  →  threshold = 0.95  (irreversible / destructive)
```

### 5.2 Decision Rules in PLAN State

1. **`confidence >= threshold`** → emit `decision: proceed`, go to EXECUTE
2. **`confidence < threshold` AND `risk_score < 0.4`** → emit `decision: proceed_with_audit` with `audit_flag: true`, go to EXECUTE (humans review later)
3. **`confidence < threshold` AND `risk_score >= 0.4`** → FALLBACK immediately (high risk + low confidence = unacceptable)

### 5.3 RiskAssessor Module

- Pure Python, no LLM, < 50 LOC.
- Inputs: step list, irreversibility flags, external cost multipliers, safety invariants.
- Output: `risk_score ∈ [0.0, 1.0]`.
- State Manager is sole enforcer of thresholds.

---

## 6. Event Schema v0.1 — LOCKED

### 6.1 JSON Structure (Required Fields)

```json
{
  "eventId":    "<string>",
  "timestamp":  "<ISO 8601>",
  "planId":     "<uuid or null on genesis>",
  "transition": "<enum — see 6.2>",
  "stateBefore": "<object or null>",
  "stateAfter": "<object or null>",
  "confidence": <0.0 to 1.0>,
  "risk_score": <0.0 to 1.0 — REQUIRED on PLAN/VALIDATE>,
  "audit_flag": <boolean — optional, default false>,
  "decision": "<enum — see 6.2>",
  "rationale": "<string — MUST be >= 50 characters>",
  "version": 1
}
```

### 6.2 Enums (Underscores — FINAL)

**transition:**
```
task_received | plan_proposed | plan_validated | execution_started
step_complete | step_failed | plan_abandoned | task_complete | error
```

**decision:**
```
proceed | proceed_with_audit | pivot | reject_malformed
commit | request_clarification | escalate | abort
```

### 6.3 Validation Rules (Wrapper Enforced)

**HARD REJECT if:**
- Missing required fields
- Wrong types
- `confidence` or `risk_score` outside [0.0, 1.0]
- Invalid enum values
- `rationale` < 50 characters ← **Most common failure**
- Duplicate `eventId`
- Non-monotonic timestamp
- Non-genesis event with `planId = null`
- `risk_score` missing on PLAN or VALIDATE transition

**On reject:** Wrapper appends error event with exact error code. Agent reads it next cycle and replans.

### 6.4 Error Codes

| Code | Description |
|------|-------------|
| `MISSING_REQUIRED_FIELD` | Agent emitted event missing a required key. |
| `TYPE_MISMATCH` | Field type does not match schema. |
| `OUT_OF_RANGE` | `confidence` or `risk_score` outside 0.0–1.0. |
| `INVALID_ENUM` | `transition` or `decision` value not in allowed enum. |
| `RATIONALE_TOO_SHORT` | `rationale` < 50 characters. |
| `DUPLICATE_EVENT_ID` | `eventId` already exists. Ignore (idempotent). |
| `TIMESTAMP_OUT_OF_ORDER` | `timestamp` earlier than previous event. |
| `MISSING_PLAN_ID_ON_NON_GENESIS` | Non-genesis event has `planId = null`. |
| `MISSING_RISK_SCORE` | `risk_score` absent on PLAN or VALIDATE. |

---

## 7. Module Roles

All modules communicate ONLY via State Manager event bus. Zero shared mutable state.

| Module | Owner | Key Inputs | Key Outputs |
|--------|-------|-----------|------------|
| Task Intake & Parsing | Lucas | Raw payload | TaskRepr + BeliefState |
| Planning Engine | Harper | TaskRepr + WorldModel | Plan[] with confidences + risk_score |
| RiskAssessor | Pure Code | Step list + costs | risk_score [0,1] |
| Execution Engine | Benjamin | PlanStep | ActionLog + results |
| Observation & Memory | Benjamin | Raw observations | ObservationRecord + WorldModel delta |
| Validation & Critic | Harper | History + observation | ValidationScore + trace |
| State Manager | Grok | All module outputs | Transition command + record |
| Fallback Manager | Grok | Trigger signals | Policy execution command |

---

## 8. Open Items

| # | Item | Priority | Phase | Status |
|---|------|----------|-------|--------|
| 1 | FALLBACK → prior state logic | HIGH | Phase 1 | ✅ **RESOLVED** — Always return to PLAN |
| 2 | LowConfAudit human review trigger | Medium | Phase 2 | — |
| 3 | Conservative plan cache | Medium | Phase 2 | — |
| 4 | Hash-chaining on log | Low | Phase 2 | — |

---

## 9. Build Order & Current Progress

| # | Deliverable | Status | Notes |
|---|-------------|--------|-------|
| 1 | **Agent Prompt Template** | ✅ **COMPLETE** | File: `AGENT_PROMPT_TEMPLATE.md`. Commit: `dd7f00a`. Forces agent to emit exactly schema. Rationale discipline baked in. Error feedback loop explained. |
| 2 | **Wrapper Validation + Error Event Logic** | ⏳ **NEXT** | Pseudocode for validation layer. Hard rejections with error codes. Error event emission. |
| 3 | RiskAssessor Module | — | Pure Python < 50 LOC. Deterministic risk_score. |
| 4 | State Machine Skeleton | — | Enums, transition validator, structured logging. |
| 5 | Document Classification Pressure Test | — | Multi-step task validating determinism + fail-forward. |
| 6 | Edge Case Mock: Offline/Concurrency/Multi-User | — | After skeleton proven. |

---

## 10. Deliverables Completed

### 10.1 AGENT_PROMPT_TEMPLATE.md (Commit: dd7f00a)

**What it does:**
- Complete schema specification with all required fields, enums, validation rules
- Rationale discipline enforcement (>= 50 chars — no exceptions)
- Fail-forward philosophy with worked examples (gripper grasp failure)
- Confidence/risk decision formula with three decision branches
- Error feedback loop: agent reads wrapper rejections and fixes them
- Typical execution flow (genesis → intake → plan → execute → observe → validate)
- Session start checklist
- Rules of engagement (emit JSON, read full log, never undo, etc.)

**How to use:**
- Paste this into every new agent session as opening context
- Agent confirms understanding of schema, state machine, and fail-forward discipline
- Agent then requests current event log and active `planId` from wrapper/system
- Agent begins emitting structured events

**Key discipline:**
- Every event must match schema exactly or it gets hard-rejected
- Rationale must explain *why*, not just what
- Agent must read error events and fix broken submissions
- No prose outside the JSON — only structured events

---

## 11. Immediate Next Steps

### For Next Agent/Session:

1. **Read this document top-to-bottom.**
2. **Confirm understanding:**
   - State machine transitions
   - Confidence/risk formula
   - Schema validation rules
   - Fail-forward discipline
3. **Build Item #2: Wrapper Validation + Error Event Logic**
   - Pseudocode or real code
   - Validates every event against schema
   - Emits error events with exact error codes
   - Enforces rationale >= 50 chars
   - Appendsvalidation chain to log
4. **Build Item #3: RiskAssessor Module**
   - Pure Python deterministic function
   - Input: step list, costs, safety invariants
   - Output: risk_score [0.0, 1.0]
   - Integrates into Planning Engine and Validation & Critic

### Git Workflow:

- **Branch:** `claude/assessment-implementation-7Csi8`
- **Commit message format:**
  ```
  [Feature] Brief title

  Detailed explanation of what and why.

  https://claude.ai/code/session_01Jq4Rt7do746tseJWREsFfM
  ```
- **Push:** `git push -u origin claude/assessment-implementation-7Csi8`

### Key Files:

- **`AGENT_PROMPT_TEMPLATE.md`** — Agent execution rules (360 lines)
- **`HANDOVER_COMPLETE.md`** — This document (full context + build state)

---

## 12. Philosophy Reminders

> *"Every decision is visible in the log. Audit trail is perfect by design."*

- Agent stays task-focused. Wrapper handles plumbing: timestamps, idempotency, enforcement.
- Reasoning IS the transition function — not a pre-step, not decoration.
- Phase 1 character: rigid industrial robot. Fluidity is a Phase 2 feature.
- If you cannot explain a decision with explicit structured rationale, you must not proceed silently.
- Single source of truth = append-only log. Mutations only via annotated state deltas on failure.

---

## 13. Session Context

- **Repository:** `/home/user/OpenMindForkYou`
- **Branch:** `claude/assessment-implementation-7Csi8`
- **Last commit:** `dd7f00a` — Agent Prompt Template (2026-02-24 14:02:00Z approx)
- **Current status:** Build Order Item #1 complete. Item #2 ready to start.
- **Agents:** Claude (Orchestrator), Agent 2 (Creative Specialist), Grok (Captain), Harper (Planning), Benjamin (Execution), Lucas (Intake)

---

*OpenMind v1 Complete Handover — v0.3 | 2026-02-24*
*Canonical source of truth. Paste this into every new session. Do not begin work without confirming understanding of locked decisions.*
