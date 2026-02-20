# OpenMind PRD

## Original Problem Statement
Build and rebrand the MoltBot/OpenClaw app into **OpenMind** with a polished UI, memory manager, skills hub, heartbeat scheduler, onboarding wizard, and reliable startup flow for the assistant gateway. Integrate OpenRouter as an LLM provider and fix the broken `/api/openmind/start` endpoint.

## Target Users
- Solo builders and teams running a self-hosted AI assistant
- Power users who need memory editing, skills management, and scheduled tasks

## Core Requirements
- Rebrand all UI/UX to OpenMind
- Memory Manager: edit MEMORY.md + SOUL.md with preview + timeline
- Skills Hub: searchable registry with installed/available tabs
- Heartbeat Scheduler: create/manage cron jobs with history
- Onboarding Wizard for first-run setup
- Reliable gateway startup via `/api/openmind/start`
- OpenRouter provider support

## Architecture
- Frontend: React + Tailwind + shadcn/ui
- Backend: FastAPI
- DB: MongoDB (Motor)
- Gateway: supervisor-managed **clawdbot-gateway** runtime (OpenMind UI branding)

## What’s Implemented
- Full OpenMind rebrand (logo, colors, copy)
- Memory Manager, Skills Hub, Heartbeat Scheduler, Chat, Settings pages
- Onboarding wizard + command palette + theme toggle
- OpenRouter integration (backend)
- **Gateway startup fix**: restored real `/api/openmind/start` flow, aligned config/env with supervised gateway

## Current Status (2026-02-20)
- `/api/openmind/start` now calls real gateway startup logic and writes config/env correctly for supervisor runtime
- Added env-driven base URLs for providers
- Updated gateway env and supervisor program alignment

## Known Issues
- Start flow requires authenticated owner session; needs user verification after login (auth lock is active)

## Prioritized Backlog
### P0
- User verify: OpenMind start flow succeeds post-login and Control UI loads

### P1
- Wire Chat UI to LLM backend for real conversations
- Persist Skills/Scheduler/Audit data in MongoDB (remove mock data)

### P2
- Memory timeline search + export
- Skills SDK for third-party developers
- Scheduler delivery channels + error handling
- Onboarding reset in Settings

Last updated: 2026-02-20