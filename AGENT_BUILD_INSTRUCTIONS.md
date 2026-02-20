# 🤖 OpenMind — Agent Build Instructions
> **For: Kimi K2.5 / Z.AI GLM5 Coding Agents**
> **Repo:** `dicacid/OpenMindForkYou`
> **Last Updated:** 2026-02-20

---

## AGENT CONTEXT: READ THIS FIRST

You are building on top of an existing **partially complete** self-hosted AI assistant platform called **OpenMind**. It is a FARM stack app (FastAPI + React + MongoDB). A base scaffold already exists — your job is to **complete and extend it** with real functionality.

### What Already Exists (DO NOT rewrite these from scratch)
| File | Status | Notes |
|---|---|---|
| `backend/server.py` | ✅ Exists (66KB) | Main FastAPI app — add new routes, do not delete existing ones |
| `backend/llm_integration.py` | ✅ Exists | `OpenMindLLM` class supports OpenAI, Anthropic, Gemini, OpenRouter |
| `backend/memory_manager.py` | ✅ Exists | Reads/writes `MEMORY.md` and `SOUL.md` to `~/openmind-workspace/` |
| `backend/scheduler_manager.py` | ⚠️ Skeleton | Has cron helpers but NO real job execution — needs wiring |
| `backend/skills_manager.py` | ⚠️ Skeleton | Has MongoDB document helpers but NO registry — needs wiring |
| `backend/supervisor_client.py` | ✅ Exists | Manages the clawdbot-gateway process |
| `backend/gateway_config.py` | ✅ Exists | Writes Moltbot/OpenMind gateway config |
| `backend/whatsapp_monitor.py` | ⚠️ Skeleton | Stub — wire to notifications |
| `backend/requirements.txt` | ✅ Exists | Add new deps here |
| `frontend/` | ✅ Exists | React + Tailwind + shadcn/ui — add pages/components |
| `memory/PRD.md` | ✅ Exists | Product requirements — read for context |

### Key Constraints
- **Do NOT break existing endpoints.** Only add new ones.
- **Do NOT change the auth system.** Google Auth + httpOnly cookies are in place.
- **MongoDB collections** already used: `users`, `user_sessions`. New ones you create: `skills`, `scheduled_jobs`, `job_executions`, `chat_sessions`, `agent_runs`.
- **Environment variables** expected: `EMERGENT_LLM_KEY`, `MONGO_URI`, `GOOGLE_CLIENT_ID`, `DISCORD_WEBHOOK_URL` (optional), `TELEGRAM_BOT_TOKEN` (optional), `TELEGRAM_CHAT_ID` (optional).
- All backend work in `backend/` directory. All frontend work in `frontend/src/`.
- Write `async` Python throughout — this is an `asyncio`/`motor` codebase.

---

## TASK 1 — Wire Chat UI to LLM Backend (PRIORITY: P0)

### Objective
The Chat page exists in the frontend but sends messages nowhere. Connect it to the `OpenMindLLM` class so users can actually have conversations.

### Backend: Add to `backend/server.py`

Add these imports at the top if not present:
```python
from llm_integration import OpenMindLLM
from memory_manager import get_soul_content, add_memory_entry
```

Add these Pydantic models:
```python
class ChatMessage(BaseModel):
    message: str
    session_id: Optional[str] = "default"
    provider: Optional[str] = "openai"
    model: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    session_id: str
    provider: str
    model: str
```

Add these endpoints:
```python
@app.post("/api/chat/send")
async def send_chat_message(
    payload: ChatMessage,
    current_user: dict = Depends(get_current_user)
):
    """Send a chat message and get a response from the LLM"""
    try:
        # Get API key from user session or environment
        api_key = current_user.get("api_key") or os.getenv("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(status_code=400, detail="No API key configured")

        llm = OpenMindLLM(
            provider=payload.provider,
            model=payload.model,
            api_key=api_key
        )

        # Use SOUL.md as system prompt
        soul = get_soul_content()

        # Send message
        response_text = await llm.chat(
            message=payload.message,
            session_id=payload.session_id,
            system_message=soul
        )

        # Log exchange to MEMORY.md
        add_memory_entry("conversation", f"User: {payload.message}\nAssistant: {response_text[:500]}")

        # Persist to MongoDB chat_sessions collection
        await db.chat_sessions.insert_one({
            "user_id": current_user["_id"],
            "session_id": payload.session_id,
            "role": "exchange",
            "user_message": payload.message,
            "assistant_response": response_text,
            "provider": payload.provider,
            "model": payload.model or llm.model,
            "timestamp": datetime.now(timezone.utc)
        })

        return {
            "response": response_text,
            "session_id": payload.session_id,
            "provider": payload.provider,
            "model": llm.model
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/chat/history/{session_id}")
async def get_chat_history(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    limit: int = 50
):
    """Get chat history for a session"""
    history = await db.chat_sessions.find(
        {"user_id": current_user["_id"], "session_id": session_id}
    ).sort("timestamp", -1).limit(limit).to_list(length=limit)

    return {"history": history, "session_id": session_id}


@app.get("/api/chat/sessions")
async def list_chat_sessions(current_user: dict = Depends(get_current_user)):
    """List all chat sessions for the current user"""
    sessions = await db.chat_sessions.distinct(
        "session_id", {"user_id": current_user["_id"]}
    )
    return {"sessions": sessions}


@app.get("/api/llm/models")
async def get_available_models():
    """Return all available LLM providers and models"""
    return OpenMindLLM.get_available_models()
```

### Frontend: Update Chat page

File to update: `frontend/src/pages/Chat.jsx` (or `.tsx`)

The Chat component should:
1. Have a `selectedProvider` state (default `"openai"`) with a dropdown
2. Have a `selectedModel` state populated from `GET /api/llm/models`
3. On send: `POST /api/chat/send` with `{ message, session_id, provider, model }`
4. Display the `response` field from the API response in the message list
5. Show a loading spinner while awaiting response
6. Store `session_id` in component state (default: `crypto.randomUUID()` on mount)

### Success Criteria
- [ ] User can type a message, click Send, and get a real LLM response
- [ ] Provider dropdown shows: OpenAI, Anthropic, Gemini, OpenRouter
- [ ] Chat history persists to MongoDB and can be retrieved
- [ ] SOUL.md content is injected as system prompt
- [ ] No existing endpoints return 500 after this change

---

## TASK 2 — Persist Skills to MongoDB (PRIORITY: P1)

### Objective
Replace the mock/placeholder Skills Hub data with real MongoDB-backed CRUD. The `skills_manager.py` skeleton already exists — extend it and wire up the endpoints.

### Backend: Replace `backend/skills_manager.py` entirely

```python
"""Skills Manager - MongoDB-backed skills registry"""
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
import uuid

# ── Built-in skill definitions ────────────────────────────────────────────────
BUILTIN_SKILLS = [
    {
        "skill_id": "browser_scrape",
        "name": "Web Scraper",
        "description": "Scrape any URL and extract text or structured data using CSS selectors",
        "category": "browser",
        "version": "1.0.0",
        "builtin": True,
        "parameters": {
            "url": {"type": "string", "required": True, "description": "URL to scrape"},
            "selectors": {"type": "object", "required": False, "description": "CSS selector map {key: selector}"},
            "wait_for": {"type": "string", "required": False, "description": "CSS selector to wait for before scraping"}
        },
        "tags": ["web", "scraping", "automation"]
    },
    {
        "skill_id": "crypto_price",
        "name": "Crypto Price Check",
        "description": "Get current price and 24h change for any cryptocurrency from CoinGecko",
        "category": "crypto",
        "version": "1.0.0",
        "builtin": True,
        "parameters": {
            "coin_id": {"type": "string", "required": True, "description": "CoinGecko coin ID (e.g. ethereum, bitcoin)"},
            "currency": {"type": "string", "required": False, "description": "Fiat currency (default: usd)"}
        },
        "tags": ["crypto", "finance", "price"]
    },
    {
        "skill_id": "wallet_monitor",
        "name": "Wallet Activity Monitor",
        "description": "Check recent transactions for an Ethereum wallet address via Etherscan",
        "category": "crypto",
        "version": "1.0.0",
        "builtin": True,
        "parameters": {
            "address": {"type": "string", "required": True, "description": "Ethereum wallet address (0x...)"},
            "network": {"type": "string", "required": False, "description": "Network: ethereum, polygon, bsc (default: ethereum)"}
        },
        "tags": ["crypto", "blockchain", "wallet", "ethereum"]
    },
    {
        "skill_id": "github_summarize",
        "name": "GitHub Repo Summarizer",
        "description": "Fetch and summarize a GitHub repository's recent activity",
        "category": "development",
        "version": "1.0.0",
        "builtin": True,
        "parameters": {
            "repo": {"type": "string", "required": True, "description": "owner/repo format"},
            "days": {"type": "integer", "required": False, "description": "Look back N days (default: 7)"}
        },
        "tags": ["github", "development", "code"]
    },
    {
        "skill_id": "send_notification",
        "name": "Send Notification",
        "description": "Send a message to Discord webhook or Telegram bot",
        "category": "communication",
        "version": "1.0.0",
        "builtin": True,
        "parameters": {
            "channel": {"type": "string", "required": True, "description": "discord or telegram"},
            "message": {"type": "string", "required": True, "description": "Message to send"}
        },
        "tags": ["notifications", "discord", "telegram", "alerts"]
    },
    {
        "skill_id": "execute_python",
        "name": "Python Executor",
        "description": "Execute sandboxed Python code and return stdout/result",
        "category": "development",
        "version": "1.0.0",
        "builtin": True,
        "parameters": {
            "code": {"type": "string", "required": True, "description": "Python code to execute"},
            "timeout": {"type": "integer", "required": False, "description": "Max execution time in seconds (default: 10)"}
        },
        "tags": ["python", "code", "execution"]
    },
    {
        "skill_id": "memory_search",
        "name": "Memory Search",
        "description": "Search MEMORY.md for relevant past facts, conversations or project notes",
        "category": "memory",
        "version": "1.0.0",
        "builtin": True,
        "parameters": {
            "query": {"type": "string", "required": True, "description": "Search term or phrase"}
        },
        "tags": ["memory", "search", "recall"]
    }
]


def create_skill_document(skill_id: str, config: Optional[Dict[str, Any]] = None) -> dict:
    """Create a user-installed skill document for MongoDB"""
    return {
        "skill_id": skill_id,
        "enabled": True,
        "config": config or {},
        "installed_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }


def update_skill_config(skill_id: str, config: Dict[str, Any]) -> dict:
    """Update skill configuration"""
    return {
        "config": config,
        "updated_at": datetime.now(timezone.utc)
    }


def get_builtin_skills(category: str = None, search: str = None) -> List[dict]:
    """Return builtin skills with optional filtering"""
    skills = BUILTIN_SKILLS
    if category:
        skills = [s for s in skills if s["category"] == category]
    if search:
        search_lower = search.lower()
        skills = [s for s in skills if
                  search_lower in s["name"].lower() or
                  search_lower in s["description"].lower() or
                  any(search_lower in tag for tag in s["tags"])]
    return skills


def get_skill_categories() -> List[str]:
    """Return unique categories from builtin skills"""
    return list(set(s["category"] for s in BUILTIN_SKILLS))
```

### Backend: Add Skills endpoints to `backend/server.py`

Add these imports if not present:
```python
from skills_manager import create_skill_document, update_skill_config, get_builtin_skills, get_skill_categories
```

Add these endpoints:
```python
@app.get("/api/skills/available")
async def get_available_skills(
    category: Optional[str] = None,
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all available builtin skills with optional filtering"""
    skills = get_builtin_skills(category=category, search=search)
    
    # Mark which ones are already installed by this user
    installed = await db.skills.find(
        {"user_id": current_user["_id"]}
    ).to_list(length=100)
    installed_ids = {s["skill_id"] for s in installed}
    
    for skill in skills:
        skill["installed"] = skill["skill_id"] in installed_ids
    
    return {"skills": skills, "categories": get_skill_categories()}


@app.get("/api/skills/installed")
async def get_installed_skills(current_user: dict = Depends(get_current_user)):
    """Get all skills installed by the current user"""
    installed = await db.skills.find(
        {"user_id": current_user["_id"]}
    ).to_list(length=100)
    
    # Merge with builtin definitions for full metadata
    builtin_map = {s["skill_id"]: s for s in get_builtin_skills()}
    result = []
    for skill in installed:
        definition = builtin_map.get(skill["skill_id"], {})
        result.append({**definition, **skill, "_id": str(skill["_id"])})
    
    return {"skills": result}


@app.post("/api/skills/{skill_id}/install")
async def install_skill(
    skill_id: str,
    config: Optional[Dict[str, Any]] = None,
    current_user: dict = Depends(get_current_user)
):
    """Install a skill for the current user"""
    # Check if already installed
    existing = await db.skills.find_one(
        {"user_id": current_user["_id"], "skill_id": skill_id}
    )
    if existing:
        return {"ok": True, "message": "Already installed", "skill_id": skill_id}
    
    doc = create_skill_document(skill_id, config)
    doc["user_id"] = current_user["_id"]
    await db.skills.insert_one(doc)
    return {"ok": True, "message": "Skill installed", "skill_id": skill_id}


@app.delete("/api/skills/{skill_id}/uninstall")
async def uninstall_skill(
    skill_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Uninstall a skill for the current user"""
    result = await db.skills.delete_one(
        {"user_id": current_user["_id"], "skill_id": skill_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Skill not installed")
    return {"ok": True, "message": "Skill uninstalled", "skill_id": skill_id}


@app.put("/api/skills/{skill_id}/config")
async def update_skill(
    skill_id: str,
    config: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Update skill configuration"""
    update = update_skill_config(skill_id, config)
    result = await db.skills.update_one(
        {"user_id": current_user["_id"], "skill_id": skill_id},
        {"$set": update}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Skill not installed")
    return {"ok": True, "skill_id": skill_id, "config": config}
```

### Success Criteria
- [ ] `GET /api/skills/available` returns 7 builtin skills with metadata
- [ ] `POST /api/skills/browser_scrape/install` saves to MongoDB
- [ ] `GET /api/skills/installed` returns only installed skills for logged-in user
- [ ] Frontend Skills Hub shows real data from API (not mock)
- [ ] Install/uninstall buttons work

---

## TASK 3 — Wire Scheduler to Real Execution (PRIORITY: P1)

### Objective
The Heartbeat Scheduler UI exists and can create jobs. Wire actual execution of those jobs using APScheduler — when a job fires, call the LLM with the job's prompt and deliver the result.

### Add to `backend/requirements.txt`
```
apscheduler>=3.10.4
playwright>=1.40.0
aiohttp>=3.9.0
python-telegram-bot>=20.0
```

### Create `backend/autonomous_runner.py` (NEW FILE)

```python
"""Autonomous Agent Runner - executes goals using LLM + skills"""
import asyncio
import json
import re
import os
import aiohttp
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from llm_integration import OpenMindLLM
from memory_manager import get_memory_content, get_soul_content, add_memory_entry

AGENT_SYSTEM_PROMPT = """You are an autonomous agent for OpenMind. You execute goals by calling available skills.

Available skills:
- crypto_price(coin_id, currency="usd") → Get crypto price data
- wallet_monitor(address, network="ethereum") → Check wallet transactions
- browser_scrape(url, selectors=None) → Scrape a web page
- github_summarize(repo, days=7) → Summarize repo activity
- send_notification(channel, message) → Send to discord/telegram
- memory_search(query) → Search MEMORY.md
- execute_python(code, timeout=10) → Run Python code

For each step, respond ONLY with valid JSON:
{
  "action": "CALL_SKILL" | "RESPOND" | "DONE",
  "skill": "skill_name",
  "params": {"key": "value"},
  "reasoning": "brief explanation",
  "final_answer": "only when action is DONE or RESPOND"
}

Do not include any text outside the JSON block."""


async def execute_crypto_price(coin_id: str, currency: str = "usd") -> dict:
    """Get crypto price from CoinGecko"""
    url = f"https://api.coingecko.com/api/v3/simple/price?ids={coin_id}&vs_currencies={currency}&include_24hr_change=true"
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as resp:
            if resp.status == 200:
                data = await resp.json()
                return data.get(coin_id, {"error": "coin not found"})
            return {"error": f"CoinGecko API error: {resp.status}"}


async def execute_wallet_monitor(address: str, network: str = "ethereum") -> dict:
    """Get recent wallet transactions from Etherscan"""
    api_key = os.getenv("ETHERSCAN_API_KEY", "")
    url = f"https://api.etherscan.io/api?module=account&action=txlist&address={address}&sort=desc&page=1&offset=5&apikey={api_key}"
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as resp:
            if resp.status == 200:
                data = await resp.json()
                txs = data.get("result", [])
                if isinstance(txs, list):
                    return {"transactions": txs[:5], "count": len(txs)}
                return {"error": txs}
            return {"error": f"Etherscan API error: {resp.status}"}


async def execute_browser_scrape(url: str, selectors: dict = None, wait_for: str = None) -> dict:
    """Scrape a URL using Playwright"""
    try:
        from playwright.async_api import async_playwright
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            await page.goto(url, timeout=15000)
            if wait_for:
                await page.wait_for_selector(wait_for, timeout=8000)
            if selectors:
                data = {}
                for key, selector in selectors.items():
                    el = await page.query_selector(selector)
                    data[key] = (await el.inner_text()).strip() if el else None
            else:
                content = await page.inner_text("body")
                data = {"text": content[:3000]}
            await browser.close()
            return data
    except Exception as e:
        return {"error": str(e)}


async def execute_send_notification(channel: str, message: str) -> dict:
    """Send notification to Discord or Telegram"""
    if channel == "discord":
        webhook = os.getenv("DISCORD_WEBHOOK_URL")
        if not webhook:
            return {"error": "DISCORD_WEBHOOK_URL not configured"}
        async with aiohttp.ClientSession() as session:
            async with session.post(webhook, json={"content": message}) as resp:
                return {"ok": resp.status in (200, 204), "status": resp.status}

    elif channel == "telegram":
        token = os.getenv("TELEGRAM_BOT_TOKEN")
        chat_id = os.getenv("TELEGRAM_CHAT_ID")
        if not token or not chat_id:
            return {"error": "TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured"}
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"https://api.telegram.org/bot{token}/sendMessage",
                json={"chat_id": chat_id, "text": message}
            ) as resp:
                return {"ok": resp.status == 200}
    
    return {"error": f"Unknown channel: {channel}"}


async def execute_memory_search(query: str) -> dict:
    """Search MEMORY.md content for a query"""
    content = get_memory_content()
    query_lower = query.lower()
    lines = content.split("\n")
    relevant = [line for line in lines if query_lower in line.lower()]
    return {"matches": relevant[:20], "total_lines": len(lines)}


async def execute_python_code(code: str, timeout: int = 10) -> dict:
    """Execute Python code in a subprocess"""
    import subprocess
    try:
        result = subprocess.run(
            ["python3", "-c", code],
            capture_output=True, text=True, timeout=timeout
        )
        return {
            "stdout": result.stdout[:2000],
            "stderr": result.stderr[:500],
            "returncode": result.returncode
        }
    except subprocess.TimeoutExpired:
        return {"error": "Execution timed out"}
    except Exception as e:
        return {"error": str(e)}


SKILL_EXECUTORS = {
    "crypto_price": execute_crypto_price,
    "wallet_monitor": execute_wallet_monitor,
    "browser_scrape": execute_browser_scrape,
    "send_notification": execute_send_notification,
    "memory_search": execute_memory_search,
    "execute_python": execute_python_code,
}


class AutonomousRunner:
    """Executes a goal through an agentic LLM loop with skill calling"""

    def __init__(self, api_key: str = None, provider: str = "openai", model: str = None):
        self.api_key = api_key or os.getenv("EMERGENT_LLM_KEY")
        self.provider = provider
        self.model = model
        self.llm = OpenMindLLM(provider=provider, model=model, api_key=self.api_key)

    async def run(self, goal: str, max_steps: int = 8) -> dict:
        """
        Execute an autonomous goal loop.
        Returns dict with: success, result, steps, error
        """
        steps = []
        conversation_history = [
            {"role": "system", "content": AGENT_SYSTEM_PROMPT},
            {"role": "user", "content": f"Goal: {goal}"}
        ]

        for step_num in range(max_steps):
            try:
                # Get LLM decision
                prompt = conversation_history[-1]["content"]
                raw_response = await self.llm.chat(
                    message=prompt,
                    session_id=f"agent_{goal[:20]}",
                    system_message=AGENT_SYSTEM_PROMPT
                )

                # Parse JSON response
                parsed = self._parse_json_response(raw_response)
                steps.append({
                    "step": step_num + 1,
                    "action": parsed.get("action"),
                    "skill": parsed.get("skill"),
                    "params": parsed.get("params"),
                    "reasoning": parsed.get("reasoning"),
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })

                action = parsed.get("action", "DONE")

                # Terminal states
                if action in ("DONE", "RESPOND"):
                    final = parsed.get("final_answer", raw_response)
                    add_memory_entry("agent_run", f"Goal: {goal}\nResult: {final[:300]}")
                    return {
                        "success": True,
                        "result": final,
                        "steps": steps,
                        "steps_taken": step_num + 1
                    }

                # Execute skill
                if action == "CALL_SKILL":
                    skill_name = parsed.get("skill")
                    params = parsed.get("params", {})
                    executor = SKILL_EXECUTORS.get(skill_name)

                    if not executor:
                        skill_result = {"error": f"Unknown skill: {skill_name}"}
                    else:
                        try:
                            skill_result = await executor(**params)
                        except Exception as e:
                            skill_result = {"error": str(e)}

                    steps[-1]["skill_result"] = skill_result
                    conversation_history.append({
                        "role": "user",
                        "content": f"Skill '{skill_name}' returned: {json.dumps(skill_result)}\n\nContinue toward the goal: {goal}"
                    })

            except Exception as e:
                steps.append({"step": step_num + 1, "error": str(e)})
                return {"success": False, "error": str(e), "steps": steps}

        return {
            "success": False,
            "error": "Max steps reached without completing goal",
            "steps": steps
        }

    def _parse_json_response(self, text: str) -> dict:
        """Extract JSON from LLM response text"""
        # Try direct parse
        try:
            return json.loads(text.strip())
        except Exception:
            pass
        # Try extracting from markdown code block
        match = re.search(r'```(?:json)?\s*([\s\S]*?)```', text)
        if match:
            try:
                return json.loads(match.group(1).strip())
            except Exception:
                pass
        # Try finding first { } block
        match = re.search(r'\{[\s\S]*\}', text)
        if match:
            try:
                return json.loads(match.group(0))
            except Exception:
                pass
        # Fallback
        return {"action": "DONE", "final_answer": text}
```

### Create `backend/job_runner.py` (NEW FILE)

```python
"""Job Runner - connects APScheduler to AutonomousRunner"""
import logging
from datetime import datetime, timezone
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from autonomous_runner import AutonomousRunner

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler(timezone="UTC")


def get_scheduler() -> AsyncIOScheduler:
    return scheduler


async def execute_scheduled_job(job_id: str, goal: str, user_id: str, delivery_channel: str, db):
    """Called by APScheduler when a job fires"""
    logger.info(f"Executing scheduled job {job_id}: {goal[:60]}")
    
    # Update last_run_at
    await db.scheduled_jobs.update_one(
        {"_id": job_id},
        {"$set": {"last_run_at": datetime.now(timezone.utc), "last_run_status": "running"}}
    )

    try:
        runner = AutonomousRunner()
        result = await runner.run(goal)

        status = "success" if result["success"] else "failed"
        output = result.get("result") or result.get("error", "No output")

        # Log execution
        await db.job_executions.insert_one({
            "job_id": job_id,
            "user_id": user_id,
            "goal": goal,
            "status": status,
            "output": output,
            "steps": result.get("steps", []),
            "executed_at": datetime.now(timezone.utc)
        })

        # Update job status
        await db.scheduled_jobs.update_one(
            {"_id": job_id},
            {"$set": {"last_run_status": status}}
        )

        # Send notification if channel configured and job succeeded
        if result["success"] and delivery_channel in ("discord", "telegram"):
            from autonomous_runner import execute_send_notification
            await execute_send_notification(
                delivery_channel,
                f"✅ OpenMind Job: {goal[:80]}\n\n{output[:500]}"
            )

    except Exception as e:
        logger.error(f"Job {job_id} failed: {e}")
        await db.scheduled_jobs.update_one(
            {"_id": job_id},
            {"$set": {"last_run_status": "error"}}
        )
        await db.job_executions.insert_one({
            "job_id": job_id,
            "goal": goal,
            "status": "error",
            "output": str(e),
            "executed_at": datetime.now(timezone.utc)
        })


async def register_all_active_jobs(db):
    """On startup, reload all active jobs from MongoDB into APScheduler"""
    jobs = await db.scheduled_jobs.find({"active": True}).to_list(length=200)
    for job in jobs:
        try:
            scheduler.add_job(
                func=execute_scheduled_job,
                trigger=CronTrigger.from_crontab(job["cron_expression"]),
                args=[str(job["_id"]), job["prompt"], str(job["user_id"]), job.get("delivery_channel", "none"), db],
                id=str(job["_id"]),
                replace_existing=True
            )
            logger.info(f"Registered job: {job['name']}")
        except Exception as e:
            logger.warning(f"Failed to register job {job.get('name')}: {e}")
```

### Backend: Add Scheduler endpoints to `backend/server.py`

Add this import:
```python
from job_runner import get_scheduler, register_all_active_jobs, execute_scheduled_job
from scheduler_manager import create_job_document, create_execution_log, validate_cron, get_next_run_time
from apscheduler.triggers.cron import CronTrigger
```

Add to the FastAPI startup event (find `@app.on_event("startup")` or create it):
```python
@app.on_event("startup")
async def startup_event():
    scheduler = get_scheduler()
    scheduler.start()
    await register_all_active_jobs(db)
    logger.info("APScheduler started and jobs registered")
```

Add these endpoints:
```python
@app.post("/api/scheduler/jobs")
async def create_job(
    name: str,
    cron: str,
    prompt: str,
    delivery_channel: str = "none",
    current_user: dict = Depends(get_current_user)
):
    """Create a new scheduled autonomous job"""
    if not validate_cron(cron):
        raise HTTPException(status_code=400, detail=f"Invalid cron expression: {cron}")

    doc = create_job_document(name, cron, prompt, delivery_channel)
    doc["user_id"] = current_user["_id"]
    result = await db.scheduled_jobs.insert_one(doc)
    job_id = str(result.inserted_id)

    # Register with APScheduler
    scheduler = get_scheduler()
    scheduler.add_job(
        func=execute_scheduled_job,
        trigger=CronTrigger.from_crontab(cron),
        args=[job_id, prompt, str(current_user["_id"]), delivery_channel, db],
        id=job_id,
        replace_existing=True
    )

    return {"ok": True, "job_id": job_id, "next_run": get_next_run_time(cron)}


@app.get("/api/scheduler/jobs")
async def list_jobs(current_user: dict = Depends(get_current_user)):
    """List all scheduled jobs for the current user"""
    jobs = await db.scheduled_jobs.find(
        {"user_id": current_user["_id"]}
    ).sort("created_at", -1).to_list(length=100)
    for job in jobs:
        job["_id"] = str(job["_id"])
    return {"jobs": jobs}


@app.delete("/api/scheduler/jobs/{job_id}")
async def delete_job(job_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a scheduled job"""
    result = await db.scheduled_jobs.delete_one(
        {"_id": job_id, "user_id": current_user["_id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Remove from APScheduler
    scheduler = get_scheduler()
    try:
        scheduler.remove_job(job_id)
    except Exception:
        pass

    return {"ok": True}


@app.post("/api/scheduler/jobs/{job_id}/run-now")
async def run_job_now(job_id: str, current_user: dict = Depends(get_current_user)):
    """Manually trigger a scheduled job immediately"""
    job = await db.scheduled_jobs.find_one(
        {"_id": job_id, "user_id": current_user["_id"]}
    )
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Fire async
    asyncio.create_task(execute_scheduled_job(
        job_id, job["prompt"], str(current_user["_id"]),
        job.get("delivery_channel", "none"), db
    ))

    return {"ok": True, "message": "Job triggered — check executions for result"}


@app.get("/api/scheduler/jobs/{job_id}/executions")
async def get_job_executions(job_id: str, current_user: dict = Depends(get_current_user)):
    """Get execution history for a job"""
    execs = await db.job_executions.find(
        {"job_id": job_id}
    ).sort("executed_at", -1).limit(20).to_list(length=20)
    for e in execs:
        e["_id"] = str(e["_id"])
    return {"executions": execs}


@app.post("/api/agent/run")
async def run_agent_goal(
    goal: str,
    provider: str = "openai",
    model: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Run an autonomous agent goal immediately and return the result"""
    api_key = current_user.get("api_key") or os.getenv("EMERGENT_LLM_KEY")
    runner = AutonomousRunner(api_key=api_key, provider=provider, model=model)
    
    result = await runner.run(goal)
    
    # Store run in DB
    await db.agent_runs.insert_one({
        "user_id": current_user["_id"],
        "goal": goal,
        "provider": provider,
        "model": model,
        "success": result["success"],
        "result": result.get("result"),
        "steps_taken": result.get("steps_taken"),
        "ran_at": datetime.now(timezone.utc)
    })

    return result
```

### Success Criteria
- [ ] `POST /api/scheduler/jobs` creates a job and schedules it with APScheduler
- [ ] Job executes on schedule and logs to `job_executions` collection
- [ ] `POST /api/agent/run` with `goal="Get ETH price and tell me if it's over $3000"` returns a real LLM-driven result
- [ ] `POST /api/scheduler/jobs/{id}/run-now` triggers immediate execution
- [ ] Discord/Telegram notification delivered if webhook configured

---

## TASK 4 — Notification Manager (PRIORITY: P1)

### Create `backend/notification_manager.py` (NEW FILE)

```python
"""Notification Manager - Discord, Telegram, and in-app notifications"""
import os
import aiohttp
from datetime import datetime, timezone
from typing import Optional


class NotificationManager:
    """Unified notification delivery"""

    @staticmethod
    async def send(channel: str, message: str, title: str = None) -> dict:
        if channel == "discord":
            return await NotificationManager._discord(message, title)
        elif channel == "telegram":
            return await NotificationManager._telegram(message)
        else:
            return {"ok": False, "error": f"Unknown channel: {channel}"}

    @staticmethod
    async def _discord(message: str, title: str = None) -> dict:
        webhook = os.getenv("DISCORD_WEBHOOK_URL")
        if not webhook:
            return {"ok": False, "error": "DISCORD_WEBHOOK_URL not set"}
        
        payload = {
            "embeds": [{
                "title": title or "OpenMind Alert",
                "description": message[:2048],
                "color": 0x00ff88,
                "footer": {"text": f"OpenMind • {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}"}
            }]
        }
        async with aiohttp.ClientSession() as session:
            async with session.post(webhook, json=payload) as resp:
                return {"ok": resp.status in (200, 204), "status": resp.status}

    @staticmethod
    async def _telegram(message: str) -> dict:
        token = os.getenv("TELEGRAM_BOT_TOKEN")
        chat_id = os.getenv("TELEGRAM_CHAT_ID")
        if not token or not chat_id:
            return {"ok": False, "error": "TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set"}
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"https://api.telegram.org/bot{token}/sendMessage",
                json={"chat_id": chat_id, "text": f"🤖 OpenMind\n\n{message}"}
            ) as resp:
                data = await resp.json()
                return {"ok": data.get("ok", False)}
```

---

## TASK 5 — Memory Timeline Enhancement (PRIORITY: P2)

### Backend: Add to `backend/server.py`

```python
@app.get("/api/memory/search")
async def search_memory(
    query: str,
    current_user: dict = Depends(get_current_user)
):
    """Search MEMORY.md for relevant content"""
    from memory_manager import get_memory_content
    content = get_memory_content()
    query_lower = query.lower()
    lines = content.split("\n")
    matches = []
    
    for i, line in enumerate(lines):
        if query_lower in line.lower():
            context_start = max(0, i - 1)
            context_end = min(len(lines), i + 3)
            matches.append({
                "line": i + 1,
                "text": line,
                "context": "\n".join(lines[context_start:context_end])
            })
    
    return {"query": query, "matches": matches[:30], "total": len(matches)}


@app.get("/api/memory/export")
async def export_memory(current_user: dict = Depends(get_current_user)):
    """Export both MEMORY.md and SOUL.md as downloadable text"""
    from memory_manager import get_memory_content, get_soul_content
    return {
        "memory": get_memory_content(),
        "soul": get_soul_content(),
        "exported_at": datetime.now(timezone.utc).isoformat()
    }
```

---

## TASK 6 — Frontend Pages to Add/Update

### 6A — Chat Page (`frontend/src/pages/Chat.jsx`)
Features needed:
- Provider selector dropdown: `["openai", "anthropic", "gemini", "openrouter"]`
- Model selector (populate from `GET /api/llm/models`)
- Message input with send on Enter key
- Message list showing user messages (right-aligned) and assistant responses (left-aligned)
- Loading state with typing indicator while awaiting response
- Session selector to switch between conversation sessions
- "New Chat" button that generates a new `session_id`
- Error display if API returns error

### 6B — Agent Runner Page (`frontend/src/pages/AgentRunner.jsx`) [NEW PAGE]
Features needed:
- Goal input (large textarea): `"Describe your goal in plain English"`
- Provider/Model selector (same as Chat)
- Submit button: calls `POST /api/agent/run`
- Live steps display as agent executes (or show steps from result)
- Final result display with success/failure indicator
- History of previous runs (from `agent_runs` collection)

### 6C — Scheduler Page Updates (`frontend/src/pages/Scheduler.jsx`)
Update to use real API:
- Job list from `GET /api/scheduler/jobs` (not mock data)
- Create form calling `POST /api/scheduler/jobs`
- Delete button calling `DELETE /api/scheduler/jobs/{id}`
- "Run Now" button calling `POST /api/scheduler/jobs/{id}/run-now`
- Execution history accordion per job from `GET /api/scheduler/jobs/{id}/executions`
- Show `last_run_status` badge: running | success | failed | error

### 6D — Skills Hub Updates (`frontend/src/pages/Skills.jsx`)
Update to use real API:
- Available skills grid from `GET /api/skills/available`
- Installed tab from `GET /api/skills/installed`
- Install/Uninstall buttons
- Category filter buttons
- Search input

### 6E — Add Agent Runner to Navigation
In `frontend/src/components/Sidebar.jsx` (or wherever nav is), add:
```jsx
{ name: "Agent Runner", path: "/agent", icon: BoltIcon }
```

And add route in `App.jsx`:
```jsx
<Route path="/agent" element={<AgentRunner />} />
```

---

## TASK 7 — Dependencies

### Add to `backend/requirements.txt`
```
apscheduler>=3.10.4
playwright>=1.40.0
aiohttp>=3.9.0
croniter>=1.4.1
```

### Install Playwright browsers
Add to `backend/install_openmind_deps.sh`:
```bash
# Install Playwright and Chromium
pip install playwright
playwright install chromium --with-deps
```

### Add to `frontend/package.json` dependencies
```json
"lucide-react": "^0.300.0"
```
(Already likely present — check before adding)

---

## ENVIRONMENT VARIABLES REQUIRED

Add to `.env` / environment configuration:
```bash
# Required
MONGO_URI=mongodb://localhost:27017
EMERGENT_LLM_KEY=your_api_key_here

# Optional — enable notifications
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id

# Optional — crypto skills
ETHERSCAN_API_KEY=your_etherscan_api_key
```

---

## MONGODB INDEXES TO CREATE

On startup or via migration, add these indexes for performance:
```python
# Add to startup event in server.py
await db.chat_sessions.create_index([("user_id", 1), ("session_id", 1)])
await db.scheduled_jobs.create_index([("user_id", 1), ("active", 1)])
await db.job_executions.create_index([("job_id", 1), ("executed_at", -1)])
await db.skills.create_index([("user_id", 1), ("skill_id", 1)], unique=True)
await db.agent_runs.create_index([("user_id", 1), ("ran_at", -1)])
```

---

## FILE CHANGE SUMMARY

| File | Action | Task |
|---|---|---|
| `backend/server.py` | MODIFY — add new endpoints (do NOT delete existing) | 1, 2, 3, 5 |
| `backend/skills_manager.py` | REPLACE with new version | 2 |
| `backend/autonomous_runner.py` | CREATE NEW | 3 |
| `backend/job_runner.py` | CREATE NEW | 3 |
| `backend/notification_manager.py` | CREATE NEW | 4 |
| `backend/requirements.txt` | MODIFY — add new deps | 7 |
| `backend/install_openmind_deps.sh` | MODIFY — add playwright install | 7 |
| `frontend/src/pages/Chat.jsx` | MODIFY — wire to API | 6A |
| `frontend/src/pages/AgentRunner.jsx` | CREATE NEW | 6B |
| `frontend/src/pages/Scheduler.jsx` | MODIFY — wire to real API | 6C |
| `frontend/src/pages/Skills.jsx` | MODIFY — wire to real API | 6D |
| `frontend/src/App.jsx` | MODIFY — add /agent route | 6E |
| `frontend/src/components/Sidebar.jsx` | MODIFY — add Agent Runner nav item | 6E |

---

## IMPLEMENTATION ORDER

Execute tasks in this order to avoid dependency issues:

1. **Task 7** — Install dependencies first
2. **Task 2** — Skills manager (no external deps)
3. **Task 1** — Chat + LLM (depends on llm_integration.py which already exists)
4. **Task 4** — Notification manager (no deps)
5. **Task 3** — Autonomous runner + job runner (depends on 4)
6. **Task 5** — Memory search (simple)
7. **Task 6** — Frontend updates (depends on all backend tasks)

---

## ACCEPTANCE TESTS

After implementation, verify all of the following manually:

```
[ ] POST /api/chat/send with {"message": "hello", "provider": "openai"} returns real LLM response
[ ] GET /api/skills/available returns 7 skills with metadata
[ ] POST /api/skills/crypto_price/install saves to MongoDB
[ ] GET /api/skills/installed returns installed skill
[ ] POST /api/agent/run with {"goal": "Get the price of ethereum"} returns price data via crypto_price skill
[ ] POST /api/scheduler/jobs creates a job and it appears in APScheduler
[ ] POST /api/scheduler/jobs/{id}/run-now triggers execution and saves to job_executions
[ ] GET /api/scheduler/jobs/{id}/executions returns execution log with status and output
[ ] Discord webhook sends notification if DISCORD_WEBHOOK_URL is set
[ ] Frontend Chat page sends message and displays LLM response
[ ] Frontend Agent Runner page accepts a goal and shows steps + result
[ ] Frontend Scheduler page shows real jobs from MongoDB
[ ] Frontend Skills Hub shows real skills with install/uninstall
[ ] MEMORY.md is updated after each chat message and agent run
```

---

## NOTES FOR AGENT

- The `db` object in `server.py` is a Motor AsyncIOMotorClient database — use `await db.collection_name.operation()` pattern throughout
- `get_current_user` dependency is already defined in `server.py` — use it as shown
- Do not remove the `/api/openmind/start`, `/api/openmind/status`, `/api/openmind/stop`, `/api/auth/*` endpoints
- The `OpenMindLLM` class in `llm_integration.py` already handles all provider routing — use it, do not rewrite
- All `datetime` objects should use `datetime.now(timezone.utc)` (timezone-aware)
- Use `str(object_id)` when serializing MongoDB `_id` fields to JSON
- If `EMERGENT_LLM_KEY` is set, use it as fallback when no user API key is available
