# 🤖 Agent Build Instructions for OpenMind Enhancement

**Target Agents:** Kimi K2.5, Z.ai GLM5  
**Repository:** [dicacid/OpenMindForkYou](https://github.com/dicacid/OpenMindForkYou)  
**Goal:** Transform OpenMind from a Moltbot wrapper into a fully autonomous AI agent platform with browser automation, scheduled tasks, and multi-LLM orchestration.

---

## 📋 Prerequisites Check

Before starting, verify the repository state:

```bash
# Clone if not already done
git clone https://github.com/dicacid/OpenMindForkYou.git
cd OpenMindForkYou

# Check current structure
ls -la backend/
ls -la frontend/
```

**Required files you should see:**
- `backend/server.py` (66KB - main FastAPI app)
- `backend/llm_integration.py` (5KB - LLM interface)
- `backend/memory_manager.py` (4KB - memory operations)
- `backend/scheduler_manager.py` (4KB - cron scheduler skeleton)
- `backend/skills_manager.py` (696B - placeholder)
- `memory/PRD.md` (product requirements)

---

## 🎯 Phase 1: Core Wiring (P0/P1 - Critical Path)

### Task 1.1: Wire Chat UI to LLM Backend

**File:** `backend/server.py`

**Location:** Add after line ~400 (after existing `/api/openmind/*` endpoints)

**Code to add:**

```python
from backend.llm_integration import OpenMindLLM
from backend.memory_manager import get_soul_content, add_memory_entry

@app.post("/api/chat/send")
async def send_chat_message(
    message: str = Body(...),
    session_id: str = Body(default="default"),
    current_user: dict = Depends(get_current_user)
):
    """
    Send a chat message and get LLM response
    Uses user's preferred provider from settings
    """
    try:
        # Get user preferences (fallback to defaults)
        provider = current_user.get("preferred_provider", "openai")
        model = current_user.get("preferred_model")
        api_key = current_user.get("api_key") or os.getenv("EMERGENT_LLM_KEY")
        
        # Initialize LLM
        llm = OpenMindLLM(provider=provider, model=model, api_key=api_key)
        
        # Load SOUL.md as system prompt
        soul_content = get_soul_content()
        
        # Get response
        response = await llm.chat(
            message=message,
            session_id=session_id,
            system_message=soul_content
        )
        
        # Log conversation to memory
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        memory_entry = f"**User ({timestamp}):** {message}\n\n**Assistant:** {response}"
        add_memory_entry("conversation", memory_entry)
        
        return {
            "ok": True,
            "response": response,
            "session_id": session_id,
            "provider": provider,
            "model": llm.model
        }
    
    except Exception as e:
        logger.error(f"Chat error: {e}")
        return {"ok": False, "error": str(e)}


@app.get("/api/chat/history")
async def get_chat_history(
    session_id: str = "default",
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Retrieve chat history from MongoDB"""
    try:
        messages = await db.chat_history.find(
            {"user_id": current_user["user_id"], "session_id": session_id}
        ).sort("timestamp", -1).limit(limit).to_list(length=limit)
        
        return {"ok": True, "messages": messages}
    except Exception as e:
        return {"ok": False, "error": str(e)}
```

**Testing command:**
```bash
# After adding the endpoint
curl -X POST http://localhost:8000/api/chat/send \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION_COOKIE" \
  -d '{"message": "Hello OpenMind, what can you do?", "session_id": "test-001"}'
```

---

### Task 1.2: Persist Skills to MongoDB

**File:** `backend/skills_manager.py`

**Replace entire file with:**

```python
"""Skills Manager - Registry for AI agent capabilities"""
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
import uuid

class SkillsManager:
    """Manages skill registration, discovery, and execution"""
    
    def __init__(self, db):
        self.db = db
        self.skills_collection = db.skills
        self.executions_collection = db.skill_executions
        
        # Built-in skills registry
        self.builtin_skills = {}
    
    async def register_skill(
        self,
        name: str,
        description: str,
        category: str,
        parameters: Dict[str, Any],
        handler: str = None,  # Python module path like "skills.browser.scrape_url"
        metadata: Dict[str, Any] = None
    ) -> str:
        """Register a new skill in the database"""
        
        skill_id = str(uuid.uuid4())
        skill_doc = {
            "skill_id": skill_id,
            "name": name,
            "description": description,
            "category": category,
            "parameters": parameters,
            "handler": handler,
            "metadata": metadata or {},
            "installed": True,
            "enabled": True,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        
        await self.skills_collection.insert_one(skill_doc)
        return skill_id
    
    async def list_skills(
        self,
        category: Optional[str] = None,
        installed_only: bool = False
    ) -> List[Dict]:
        """List all available skills"""
        
        query = {}
        if category:
            query["category"] = category
        if installed_only:
            query["installed"] = True
        
        skills = await self.skills_collection.find(query).to_list(length=1000)
        return skills
    
    async def get_skill(self, skill_id: str) -> Optional[Dict]:
        """Get a specific skill by ID"""
        return await self.skills_collection.find_one({"skill_id": skill_id})
    
    async def execute_skill(
        self,
        skill_id: str,
        parameters: Dict[str, Any],
        user_id: str
    ) -> Dict[str, Any]:
        """Execute a skill and log the result"""
        
        skill = await self.get_skill(skill_id)
        if not skill:
            return {"ok": False, "error": "Skill not found"}
        
        if not skill.get("enabled"):
            return {"ok": False, "error": "Skill is disabled"}
        
        execution_id = str(uuid.uuid4())
        start_time = datetime.now(timezone.utc)
        
        try:
            # Import and call the handler function
            module_path, func_name = skill["handler"].rsplit(".", 1)
            module = __import__(module_path, fromlist=[func_name])
            handler_func = getattr(module, func_name)
            
            # Execute
            result = await handler_func(**parameters)
            
            execution_log = {
                "execution_id": execution_id,
                "skill_id": skill_id,
                "skill_name": skill["name"],
                "user_id": user_id,
                "parameters": parameters,
                "result": result,
                "status": "success",
                "started_at": start_time,
                "completed_at": datetime.now(timezone.utc),
                "duration_ms": (datetime.now(timezone.utc) - start_time).total_seconds() * 1000
            }
            
            await self.executions_collection.insert_one(execution_log)
            
            return {"ok": True, "result": result, "execution_id": execution_id}
        
        except Exception as e:
            execution_log = {
                "execution_id": execution_id,
                "skill_id": skill_id,
                "skill_name": skill["name"],
                "user_id": user_id,
                "parameters": parameters,
                "error": str(e),
                "status": "failed",
                "started_at": start_time,
                "completed_at": datetime.now(timezone.utc)
            }
            
            await self.executions_collection.insert_one(execution_log)
            
            return {"ok": False, "error": str(e), "execution_id": execution_id}
    
    async def get_execution_history(
        self,
        skill_id: Optional[str] = None,
        user_id: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict]:
        """Get skill execution history"""
        
        query = {}
        if skill_id:
            query["skill_id"] = skill_id
        if user_id:
            query["user_id"] = user_id
        
        history = await self.executions_collection.find(query)\
            .sort("started_at", -1)\
            .limit(limit)\
            .to_list(length=limit)
        
        return history


# Global instance (initialized in server.py startup)
skills_manager: Optional[SkillsManager] = None


def get_skills_manager() -> SkillsManager:
    """Dependency injection helper"""
    return skills_manager
```

**Update `backend/server.py` startup:**

```python
# Add to startup event (around line 150)
from backend.skills_manager import SkillsManager, skills_manager as global_skills_manager

@app.on_event("startup")
async def startup_event():
    # ... existing code ...
    
    # Initialize skills manager
    global skills_manager
    from backend import skills_manager as sm_module
    sm_module.skills_manager = SkillsManager(db)
    
    logger.info("✅ Skills manager initialized")
```

**Add endpoints in `backend/server.py`:**

```python
@app.get("/api/skills/list")
async def list_skills(
    category: Optional[str] = None,
    installed_only: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """List all available skills"""
    from backend.skills_manager import get_skills_manager
    sm = get_skills_manager()
    skills = await sm.list_skills(category=category, installed_only=installed_only)
    return {"ok": True, "skills": skills}


@app.post("/api/skills/execute")
async def execute_skill(
    skill_id: str = Body(...),
    parameters: Dict[str, Any] = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Execute a skill"""
    from backend.skills_manager import get_skills_manager
    sm = get_skills_manager()
    result = await sm.execute_skill(
        skill_id=skill_id,
        parameters=parameters,
        user_id=current_user["user_id"]
    )
    return result


@app.get("/api/skills/history")
async def get_skill_history(
    skill_id: Optional[str] = None,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get skill execution history"""
    from backend.skills_manager import get_skills_manager
    sm = get_skills_manager()
    history = await sm.get_execution_history(
        skill_id=skill_id,
        user_id=current_user["user_id"],
        limit=limit
    )
    return {"ok": True, "history": history}
```

---

### Task 1.3: Enhance Scheduler for Goal Execution

**File:** `backend/scheduler_manager.py`

**Replace entire file with:**

```python
"""Heartbeat Scheduler - Manages cron jobs and autonomous goal execution"""
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from datetime import datetime, timezone
from typing import Optional, Dict, Any
import uuid
import asyncio

class HeartbeatScheduler:
    """Manages scheduled tasks and autonomous agent goals"""
    
    def __init__(self, db, agent_runner=None):
        self.db = db
        self.jobs_collection = db.scheduled_jobs
        self.scheduler = AsyncIOScheduler()
        self.agent_runner = agent_runner
        
        # Start scheduler
        self.scheduler.start()
    
    async def create_job(
        self,
        name: str,
        goal: str,
        cron_expression: str,
        user_id: str,
        enabled: bool = True,
        metadata: Dict[str, Any] = None
    ) -> str:
        """
        Create a new scheduled job
        
        Args:
            name: Human-readable job name
            goal: High-level goal for autonomous agent (e.g., "Check ETH price and alert if < $3000")
            cron_expression: Standard cron format (e.g., "0 9 * * *" for 9am daily)
            user_id: User who owns this job
            enabled: Whether job is active
            metadata: Additional config (notification channels, max execution time, etc.)
        """
        
        job_id = str(uuid.uuid4())
        
        job_doc = {
            "job_id": job_id,
            "name": name,
            "goal": goal,
            "cron": cron_expression,
            "user_id": user_id,
            "enabled": enabled,
            "metadata": metadata or {},
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "last_run": None,
            "next_run": None,
            "execution_count": 0,
            "executions": []
        }
        
        # Store in MongoDB
        await self.jobs_collection.insert_one(job_doc)
        
        # Schedule with APScheduler if enabled
        if enabled:
            self.scheduler.add_job(
                func=self._execute_job,
                trigger=CronTrigger.from_crontab(cron_expression),
                args=[job_id, user_id, goal],
                id=job_id,
                name=name,
                replace_existing=True
            )
        
        return job_id
    
    async def _execute_job(self, job_id: str, user_id: str, goal: str):
        """Internal: Execute a scheduled job"""
        
        execution_id = str(uuid.uuid4())
        start_time = datetime.now(timezone.utc)
        
        try:
            # Run autonomous agent with the goal
            if self.agent_runner:
                result = await self.agent_runner.run_goal(goal=goal, user_id=user_id)
            else:
                result = {"warning": "Agent runner not initialized, skipping execution"}
            
            execution_log = {
                "execution_id": execution_id,
                "timestamp": start_time,
                "status": "success",
                "result": result,
                "duration_ms": (datetime.now(timezone.utc) - start_time).total_seconds() * 1000
            }
            
        except Exception as e:
            execution_log = {
                "execution_id": execution_id,
                "timestamp": start_time,
                "status": "failed",
                "error": str(e),
                "duration_ms": (datetime.now(timezone.utc) - start_time).total_seconds() * 1000
            }
        
        # Update job record
        await self.jobs_collection.update_one(
            {"job_id": job_id},
            {
                "$set": {
                    "last_run": start_time,
                    "updated_at": datetime.now(timezone.utc)
                },
                "$inc": {"execution_count": 1},
                "$push": {
                    "executions": {
                        "$each": [execution_log],
                        "$slice": -50  # Keep last 50 executions
                    }
                }
            }
        )
    
    async def list_jobs(
        self,
        user_id: Optional[str] = None,
        enabled_only: bool = False
    ) -> list:
        """List all scheduled jobs"""
        
        query = {}
        if user_id:
            query["user_id"] = user_id
        if enabled_only:
            query["enabled"] = True
        
        jobs = await self.jobs_collection.find(query).to_list(length=1000)
        return jobs
    
    async def get_job(self, job_id: str) -> Optional[Dict]:
        """Get a specific job by ID"""
        return await self.jobs_collection.find_one({"job_id": job_id})
    
    async def update_job(
        self,
        job_id: str,
        updates: Dict[str, Any]
    ) -> bool:
        """Update job configuration"""
        
        updates["updated_at"] = datetime.now(timezone.utc)
        
        result = await self.jobs_collection.update_one(
            {"job_id": job_id},
            {"$set": updates}
        )
        
        # If cron or enabled changed, reschedule
        if "cron" in updates or "enabled" in updates:
            job = await self.get_job(job_id)
            if job:
                self.scheduler.remove_job(job_id)
                if job.get("enabled"):
                    self.scheduler.add_job(
                        func=self._execute_job,
                        trigger=CronTrigger.from_crontab(job["cron"]),
                        args=[job_id, job["user_id"], job["goal"]],
                        id=job_id,
                        name=job["name"],
                        replace_existing=True
                    )
        
        return result.modified_count > 0
    
    async def delete_job(self, job_id: str) -> bool:
        """Delete a scheduled job"""
        
        # Remove from scheduler
        try:
            self.scheduler.remove_job(job_id)
        except:
            pass
        
        # Remove from database
        result = await self.jobs_collection.delete_one({"job_id": job_id})
        return result.deleted_count > 0
    
    async def trigger_job_now(self, job_id: str):
        """Manually trigger a job execution immediately"""
        
        job = await self.get_job(job_id)
        if not job:
            return {"ok": False, "error": "Job not found"}
        
        # Execute in background
        asyncio.create_task(self._execute_job(
            job_id=job_id,
            user_id=job["user_id"],
            goal=job["goal"]
        ))
        
        return {"ok": True, "message": "Job triggered"}


# Global instance
scheduler: Optional[HeartbeatScheduler] = None


def get_scheduler() -> HeartbeatScheduler:
    """Dependency injection helper"""
    return scheduler
```

**Add scheduler endpoints in `backend/server.py`:**

```python
@app.post("/api/scheduler/create")
async def create_scheduled_job(
    name: str = Body(...),
    goal: str = Body(...),
    cron: str = Body(...),
    enabled: bool = Body(default=True),
    metadata: Optional[Dict] = Body(default=None),
    current_user: dict = Depends(get_current_user)
):
    """Create a new scheduled job"""
    from backend.scheduler_manager import get_scheduler
    scheduler = get_scheduler()
    
    job_id = await scheduler.create_job(
        name=name,
        goal=goal,
        cron_expression=cron,
        user_id=current_user["user_id"],
        enabled=enabled,
        metadata=metadata
    )
    
    return {"ok": True, "job_id": job_id}


@app.get("/api/scheduler/list")
async def list_scheduled_jobs(
    enabled_only: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """List all scheduled jobs for current user"""
    from backend.scheduler_manager import get_scheduler
    scheduler = get_scheduler()
    
    jobs = await scheduler.list_jobs(
        user_id=current_user["user_id"],
        enabled_only=enabled_only
    )
    
    return {"ok": True, "jobs": jobs}


@app.get("/api/scheduler/job/{job_id}")
async def get_scheduled_job(
    job_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get details of a specific job"""
    from backend.scheduler_manager import get_scheduler
    scheduler = get_scheduler()
    
    job = await scheduler.get_job(job_id)
    if not job:
        return {"ok": False, "error": "Job not found"}
    
    # Verify ownership
    if job["user_id"] != current_user["user_id"]:
        return {"ok": False, "error": "Unauthorized"}
    
    return {"ok": True, "job": job}


@app.post("/api/scheduler/trigger/{job_id}")
async def trigger_job_now(
    job_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Manually trigger a job execution"""
    from backend.scheduler_manager import get_scheduler
    scheduler = get_scheduler()
    
    job = await scheduler.get_job(job_id)
    if not job or job["user_id"] != current_user["user_id"]:
        return {"ok": False, "error": "Job not found or unauthorized"}
    
    result = await scheduler.trigger_job_now(job_id)
    return result


@app.delete("/api/scheduler/job/{job_id}")
async def delete_scheduled_job(
    job_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a scheduled job"""
    from backend.scheduler_manager import get_scheduler
    scheduler = get_scheduler()
    
    job = await scheduler.get_job(job_id)
    if not job or job["user_id"] != current_user["user_id"]:
        return {"ok": False, "error": "Job not found or unauthorized"}
    
    success = await scheduler.delete_job(job_id)
    return {"ok": success}
```

---

## 🚀 Phase 2: Browser Automation & Skills

### Task 2.1: Add Playwright Browser Automation Skill

**Create new directory and file:** `backend/skills/`

```bash
mkdir -p backend/skills
touch backend/skills/__init__.py
```

**File:** `backend/skills/browser_automation.py`

```python
"""Browser Automation Skill - Web scraping and interaction using Playwright"""
from playwright.async_api import async_playwright
from typing import Dict, List, Optional, Any
import asyncio

async def scrape_url(
    url: str,
    selectors: Optional[Dict[str, str]] = None,
    screenshot: bool = False,
    wait_for: Optional[str] = None,
    timeout: int = 30000
) -> Dict[str, Any]:
    """
    Scrape a web page and extract data using CSS selectors
    
    Args:
        url: Target URL to scrape
        selectors: Dict of {field_name: css_selector} to extract
        screenshot: Whether to capture a screenshot
        wait_for: CSS selector to wait for before extracting
        timeout: Max wait time in milliseconds
    
    Returns:
        Dict with extracted data and optional screenshot path
    
    Example:
        result = await scrape_url(
            url="https://coinmarketcap.com/currencies/bitcoin/",
            selectors={
                "price": ".priceValue",
                "change_24h": ".sc-16891c57-0"
            },
            screenshot=True
        )
    """
    
    result = {"url": url, "data": {}, "screenshot_path": None}
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        try:
            # Navigate to URL
            await page.goto(url, timeout=timeout)
            
            # Wait for specific element if requested
            if wait_for:
                await page.wait_for_selector(wait_for, timeout=timeout)
            
            # Extract data using selectors
            if selectors:
                for field_name, selector in selectors.items():
                    try:
                        element = await page.query_selector(selector)
                        if element:
                            result["data"][field_name] = await element.inner_text()
                        else:
                            result["data"][field_name] = None
                    except Exception as e:
                        result["data"][field_name] = f"Error: {str(e)}"
            else:
                # If no selectors, return full page content
                result["data"]["html"] = await page.content()
            
            # Take screenshot if requested
            if screenshot:
                screenshot_path = f"/tmp/screenshot_{hash(url)}.png"
                await page.screenshot(path=screenshot_path)
                result["screenshot_path"] = screenshot_path
            
        except Exception as e:
            result["error"] = str(e)
        finally:
            await browser.close()
    
    return result


async def fill_form_and_submit(
    url: str,
    form_data: Dict[str, str],
    submit_selector: str,
    wait_after_submit: int = 3000
) -> Dict[str, Any]:
    """
    Fill out a web form and submit it
    
    Args:
        url: Page URL with the form
        form_data: Dict of {field_selector: value_to_fill}
        submit_selector: CSS selector for submit button
        wait_after_submit: Time to wait after submission (ms)
    
    Returns:
        Dict with submission result and final URL
    
    Example:
        result = await fill_form_and_submit(
            url="https://example.com/contact",
            form_data={
                "#name": "John Doe",
                "#email": "john@example.com",
                "#message": "Hello!"
            },
            submit_selector="button[type='submit']"
        )
    """
    
    result = {"url": url, "success": False}
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        try:
            await page.goto(url)
            
            # Fill form fields
            for selector, value in form_data.items():
                await page.fill(selector, value)
            
            # Click submit button
            await page.click(submit_selector)
            
            # Wait for navigation or timeout
            await asyncio.sleep(wait_after_submit / 1000)
            
            result["success"] = True
            result["final_url"] = page.url
            result["page_title"] = await page.title()
            
        except Exception as e:
            result["error"] = str(e)
        finally:
            await browser.close()
    
    return result


async def monitor_page_changes(
    url: str,
    check_interval: int = 60,
    max_checks: int = 10,
    selector_to_watch: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Monitor a page for changes over time
    
    Args:
        url: Page to monitor
        check_interval: Seconds between checks
        max_checks: Maximum number of checks
        selector_to_watch: Specific element to watch (or whole page if None)
    
    Returns:
        List of change events with timestamps
    """
    
    changes = []
    previous_content = None
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        for check_num in range(max_checks):
            try:
                await page.goto(url)
                
                if selector_to_watch:
                    element = await page.query_selector(selector_to_watch)
                    current_content = await element.inner_text() if element else None
                else:
                    current_content = await page.content()
                
                if previous_content and current_content != previous_content:
                    changes.append({
                        "check_number": check_num,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "change_detected": True,
                        "previous_length": len(previous_content),
                        "current_length": len(current_content)
                    })
                
                previous_content = current_content
                
                if check_num < max_checks - 1:
                    await asyncio.sleep(check_interval)
                    
            except Exception as e:
                changes.append({
                    "check_number": check_num,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "error": str(e)
                })
        
        await browser.close()
    
    return changes


# Skill metadata for registration
BROWSER_SKILLS = [
    {
        "name": "scrape_url",
        "description": "Extract data from web pages using CSS selectors",
        "category": "browser_automation",
        "handler": "backend.skills.browser_automation.scrape_url",
        "parameters": {
            "url": {"type": "string", "required": True, "description": "Target URL"},
            "selectors": {"type": "object", "required": False, "description": "CSS selectors to extract"},
            "screenshot": {"type": "boolean", "required": False, "default": False},
            "wait_for": {"type": "string", "required": False, "description": "Selector to wait for"},
            "timeout": {"type": "integer", "required": False, "default": 30000}
        }
    },
    {
        "name": "fill_form_and_submit",
        "description": "Fill and submit web forms automatically",
        "category": "browser_automation",
        "handler": "backend.skills.browser_automation.fill_form_and_submit",
        "parameters": {
            "url": {"type": "string", "required": True},
            "form_data": {"type": "object", "required": True},
            "submit_selector": {"type": "string", "required": True},
            "wait_after_submit": {"type": "integer", "required": False, "default": 3000}
        }
    },
    {
        "name": "monitor_page_changes",
        "description": "Monitor a web page for content changes over time",
        "category": "browser_automation",
        "handler": "backend.skills.browser_automation.monitor_page_changes",
        "parameters": {
            "url": {"type": "string", "required": True},
            "check_interval": {"type": "integer", "required": False, "default": 60},
            "max_checks": {"type": "integer", "required": False, "default": 10},
            "selector_to_watch": {"type": "string", "required": False}
        }
    }
]
```

**Install Playwright dependency:**

Add to `backend/requirements.txt`:
```
playwright==1.41.0
```

Run installation:
```bash
pip install playwright
playwright install chromium
```

---

### Task 2.2: Add Cryptocurrency Skills

**File:** `backend/skills/crypto_tools.py`

```python
"""Cryptocurrency Monitoring and Analysis Skills"""
import aiohttp
from typing import Dict, List, Optional, Any
from datetime import datetime, timezone

async def check_wallet_balance(
    address: str,
    network: str = "ethereum",
    api_key: Optional[str] = None
) -> Dict[str, Any]:
    """
    Check cryptocurrency wallet balance
    
    Args:
        address: Wallet address to check
        network: Blockchain network (ethereum, bitcoin, solana, monero)
        api_key: Optional API key for rate limits (Etherscan, etc.)
    
    Returns:
        Dict with balance and recent transaction count
    """
    
    result = {"address": address, "network": network}
    
    if network == "ethereum":
        url = "https://api.etherscan.io/api"
        params = {
            "module": "account",
            "action": "balance",
            "address": address,
            "tag": "latest"
        }
        if api_key:
            params["apikey"] = api_key
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params) as response:
                data = await response.json()
                if data["status"] == "1":
                    # Convert from Wei to ETH
                    balance_wei = int(data["result"])
                    balance_eth = balance_wei / 10**18
                    result["balance"] = balance_eth
                    result["balance_wei"] = balance_wei
                else:
                    result["error"] = data.get("message", "Unknown error")
        
        # Get transaction count
        params["action"] = "txlist"
        params["page"] = 1
        params["offset"] = 10
        params["sort"] = "desc"
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params) as response:
                data = await response.json()
                if data["status"] == "1":
                    result["recent_transactions"] = len(data["result"])
                    result["last_tx_timestamp"] = data["result"][0]["timeStamp"] if data["result"] else None
    
    elif network == "bitcoin":
        url = f"https://blockchain.info/balance?active={address}"
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                data = await response.json()
                if address in data:
                    balance_satoshi = data[address]["final_balance"]
                    balance_btc = balance_satoshi / 10**8
                    result["balance"] = balance_btc
                    result["balance_satoshi"] = balance_satoshi
                    result["n_tx"] = data[address]["n_tx"]
    
    else:
        result["error"] = f"Network {network} not yet implemented"
    
    return result


async def get_crypto_price(
    symbol: str,
    currency: str = "usd"
) -> Dict[str, Any]:
    """
    Get current cryptocurrency price
    
    Args:
        symbol: Crypto symbol (btc, eth, xmr, sol, etc.)
        currency: Fiat currency for price (usd, aud, eur)
    
    Returns:
        Dict with current price and 24h change
    """
    
    url = "https://api.coingecko.com/api/v3/simple/price"
    params = {
        "ids": symbol,
        "vs_currencies": currency,
        "include_24hr_change": "true",
        "include_market_cap": "true"
    }
    
    async with aiohttp.ClientSession() as session:
        async with session.get(url, params=params) as response:
            data = await response.json()
            
            if symbol in data:
                return {
                    "symbol": symbol,
                    "currency": currency,
                    "price": data[symbol][currency],
                    "change_24h": data[symbol].get(f"{currency}_24h_change"),
                    "market_cap": data[symbol].get(f"{currency}_market_cap"),
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            else:
                return {"error": f"Symbol {symbol} not found"}


async def monitor_price_threshold(
    symbol: str,
    threshold: float,
    condition: str = "below",  # "below" or "above"
    currency: str = "usd"
) -> Dict[str, Any]:
    """
    Check if crypto price crosses a threshold
    
    Args:
        symbol: Crypto symbol
        threshold: Price threshold to check
        condition: "below" or "above"
        currency: Fiat currency
    
    Returns:
        Dict indicating if threshold was crossed
    """
    
    price_data = await get_crypto_price(symbol, currency)
    
    if "error" in price_data:
        return price_data
    
    current_price = price_data["price"]
    threshold_crossed = False
    
    if condition == "below" and current_price < threshold:
        threshold_crossed = True
    elif condition == "above" and current_price > threshold:
        threshold_crossed = True
    
    return {
        "symbol": symbol,
        "current_price": current_price,
        "threshold": threshold,
        "condition": condition,
        "threshold_crossed": threshold_crossed,
        "alert": threshold_crossed,
        "message": f"{symbol.upper()} is {condition} ${threshold}" if threshold_crossed else None
    }


async def analyze_transaction(
    tx_hash: str,
    network: str = "ethereum"
) -> Dict[str, Any]:
    """
    Analyze a blockchain transaction
    
    Args:
        tx_hash: Transaction hash to analyze
        network: Blockchain network
    
    Returns:
        Dict with transaction details
    """
    
    if network == "ethereum":
        url = "https://api.etherscan.io/api"
        params = {
            "module": "proxy",
            "action": "eth_getTransactionByHash",
            "txhash": tx_hash
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params) as response:
                data = await response.json()
                
                if "result" in data and data["result"]:
                    tx = data["result"]
                    return {
                        "hash": tx_hash,
                        "from": tx["from"],
                        "to": tx["to"],
                        "value_wei": int(tx["value"], 16),
                        "value_eth": int(tx["value"], 16) / 10**18,
                        "gas": int(tx["gas"], 16),
                        "gas_price_gwei": int(tx["gasPrice"], 16) / 10**9,
                        "block_number": int(tx["blockNumber"], 16) if tx.get("blockNumber") else None
                    }
    
    return {"error": "Transaction not found or network not supported"}


# Skill metadata
CRYPTO_SKILLS = [
    {
        "name": "check_wallet_balance",
        "description": "Check cryptocurrency wallet balance and recent activity",
        "category": "cryptocurrency",
        "handler": "backend.skills.crypto_tools.check_wallet_balance",
        "parameters": {
            "address": {"type": "string", "required": True},
            "network": {"type": "string", "required": False, "default": "ethereum"},
            "api_key": {"type": "string", "required": False}
        }
    },
    {
        "name": "get_crypto_price",
        "description": "Get current cryptocurrency price and 24h change",
        "category": "cryptocurrency",
        "handler": "backend.skills.crypto_tools.get_crypto_price",
        "parameters": {
            "symbol": {"type": "string", "required": True},
            "currency": {"type": "string", "required": False, "default": "usd"}
        }
    },
    {
        "name": "monitor_price_threshold",
        "description": "Check if crypto price crosses a threshold and trigger alert",
        "category": "cryptocurrency",
        "handler": "backend.skills.crypto_tools.monitor_price_threshold",
        "parameters": {
            "symbol": {"type": "string", "required": True},
            "threshold": {"type": "number", "required": True},
            "condition": {"type": "string", "required": False, "default": "below"},
            "currency": {"type": "string", "required": False, "default": "usd"}
        }
    },
    {
        "name": "analyze_transaction",
        "description": "Analyze blockchain transaction details",
        "category": "cryptocurrency",
        "handler": "backend.skills.crypto_tools.analyze_transaction",
        "parameters": {
            "tx_hash": {"type": "string", "required": True},
            "network": {"type": "string", "required": False, "default": "ethereum"}
        }
    }
]
```

---

### Task 2.3: Register Built-in Skills on Startup

**Update `backend/server.py` startup event:**

```python
@app.on_event("startup")
async def startup_event():
    # ... existing startup code ...
    
    # Initialize skills manager
    from backend.skills_manager import SkillsManager, skills_manager as global_sm
    from backend.skills.browser_automation import BROWSER_SKILLS
    from backend.skills.crypto_tools import CRYPTO_SKILLS
    
    global_sm.skills_manager = SkillsManager(db)
    sm = global_sm.skills_manager
    
    # Register built-in skills if not already registered
    all_skills = BROWSER_SKILLS + CRYPTO_SKILLS
    
    for skill_def in all_skills:
        existing = await db.skills.find_one({"name": skill_def["name"]})
        if not existing:
            await sm.register_skill(
                name=skill_def["name"],
                description=skill_def["description"],
                category=skill_def["category"],
                parameters=skill_def["parameters"],
                handler=skill_def["handler"]
            )
            logger.info(f"✅ Registered skill: {skill_def['name']}")
    
    logger.info("✅ Skills manager initialized with built-in skills")
```

---

## 🤖 Phase 3: Autonomous Agent Runner

### Task 3.1: Create Autonomous Agent Core

**File:** `backend/autonomous_agent.py`

```python
"""Autonomous Agent - Goal-driven task execution with skill orchestration"""
from typing import Dict, List, Any, Optional
from datetime import datetime, timezone
import json
import re
from backend.llm_integration import OpenMindLLM
from backend.skills_manager import SkillsManager
from backend.memory_manager import add_memory_entry, get_memory_content

class AutonomousAgent:
    """
    Autonomous agent that breaks down high-level goals into executable steps
    and uses available skills to accomplish them.
    """
    
    def __init__(
        self,
        llm: OpenMindLLM,
        skills_manager: SkillsManager,
        user_id: str,
        max_steps: int = 15
    ):
        self.llm = llm
        self.skills_manager = skills_manager
        self.user_id = user_id
        self.max_steps = max_steps
    
    async def run_goal(
        self,
        goal: str,
        context: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Execute a high-level goal by breaking it into steps
        
        Args:
            goal: Natural language goal (e.g., "Monitor ETH price and alert if < $3000")
            context: Additional context or constraints
        
        Returns:
            Dict with execution results and step-by-step log
        """
        
        execution_log = {
            "goal": goal,
            "user_id": self.user_id,
            "started_at": datetime.now(timezone.utc).isoformat(),
            "steps": [],
            "status": "in_progress"
        }
        
        # Get available skills
        available_skills = await self.skills_manager.list_skills(installed_only=True)
        skills_description = self._format_skills_for_prompt(available_skills)
        
        # Load memory for context
        memory = get_memory_content()
        
        # Build system prompt
        system_prompt = self._build_system_prompt(skills_description, memory, context)
        
        conversation_history = []
        
        for step_num in range(self.max_steps):
            try:
                # Get next action from LLM
                if step_num == 0:
                    user_message = f"Goal: {goal}\n\nWhat is the first step?"
                else:
                    user_message = "What's the next step? Or respond with DONE if goal is complete."
                
                response = await self.llm.chat(
                    message=user_message,
                    session_id=f"agent_{self.user_id}_{hash(goal)}",
                    system_message=system_prompt
                )
                
                conversation_history.append({
                    "step": step_num,
                    "user_message": user_message,
                    "agent_response": response
                })
                
                # Parse action from response
                action = self._parse_action(response)
                
                execution_log["steps"].append({
                    "step_number": step_num,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "action": action,
                    "raw_response": response
                })
                
                # Check if done
                if action["action"] == "DONE":
                    execution_log["status"] = "completed"
                    execution_log["result"] = action.get("result", "Goal completed successfully")
                    break
                
                # Execute skill
                elif action["action"] == "CALL_SKILL":
                    skill_result = await self._execute_skill_action(action)
                    
                    execution_log["steps"][-1]["skill_result"] = skill_result
                    
                    # Feed result back to LLM for next step
                    conversation_history.append({
                        "type": "skill_result",
                        "skill": action["skill"],
                        "result": skill_result
                    })
                
                # If agent wants to think/reason without calling skill
                elif action["action"] == "THINK":
                    execution_log["steps"][-1]["reasoning"] = action.get("reasoning", "")
                
                else:
                    execution_log["steps"][-1]["error"] = f"Unknown action: {action['action']}"
            
            except Exception as e:
                execution_log["steps"].append({
                    "step_number": step_num,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "error": str(e)
                })
                execution_log["status"] = "error"
                break
        
        # If max steps reached without completion
        if execution_log["status"] == "in_progress":
            execution_log["status"] = "max_steps_reached"
            execution_log["result"] = f"Goal not completed within {self.max_steps} steps"
        
        execution_log["completed_at"] = datetime.now(timezone.utc).isoformat()
        
        # Log to memory
        add_memory_entry("agent_execution", f"Goal: {goal}\nStatus: {execution_log['status']}\nSteps: {len(execution_log['steps'])}")
        
        return execution_log
    
    def _build_system_prompt(
        self,
        skills_description: str,
        memory: str,
        context: Optional[str]
    ) -> str:
        """Build system prompt for autonomous agent"""
        
        prompt = f"""You are OpenMind, an autonomous AI agent. Your job is to accomplish user goals by breaking them into steps and using available skills.

AVAILABLE SKILLS:
{skills_description}

MEMORY (user preferences and past interactions):
{memory[:2000]}  # Truncate to avoid token limit

RESPONSE FORMAT:
You must respond with a JSON object in one of these formats:

1. To call a skill:
{{
  "action": "CALL_SKILL",
  "skill": "skill_name",
  "parameters": {{"param1": "value1"}},
  "reasoning": "Why this step is necessary"
}}

2. To indicate completion:
{{
  "action": "DONE",
  "result": "Summary of what was accomplished",
  "reasoning": "Why the goal is now complete"
}}

3. To think/plan without executing:
{{
  "action": "THINK",
  "reasoning": "Your thought process"
}}

GUIDELINES:
- Break complex goals into simple, executable steps
- Use skills to gather information or perform actions
- Don't make assumptions - verify with actual skill calls
- If a skill fails, try an alternative approach
- Be efficient - complete goals in as few steps as possible
- Always respond with valid JSON in the exact format shown above

"""
        
        if context:
            prompt += f"\nADDITIONAL CONTEXT:\n{context}\n"
        
        return prompt
    
    def _format_skills_for_prompt(self, skills: List[Dict]) -> str:
        """Format skills list for LLM prompt"""
        
        skills_text = []
        for skill in skills:
            params = ", ".join([
                f"{p['name']}: {p.get('type', 'string')}" + (" (required)" if p.get('required') else "")
                for p in skill["parameters"].values()
            ])
            skills_text.append(
                f"- {skill['name']}: {skill['description']}\n  Parameters: {params}"
            )
        
        return "\n".join(skills_text)
    
    def _parse_action(self, response: str) -> Dict[str, Any]:
        """Parse LLM response into structured action"""
        
        # Try to extract JSON from response
        json_match = re.search(r'\{.*\}', response, re.DOTALL)
        
        if json_match:
            try:
                action = json.loads(json_match.group())
                return action
            except json.JSONDecodeError:
                pass
        
        # Fallback: if response contains "DONE", treat as completion
        if "DONE" in response.upper() or "COMPLETE" in response.upper():
            return {
                "action": "DONE",
                "result": response
            }
        
        # Otherwise, treat as thinking/reasoning
        return {
            "action": "THINK",
            "reasoning": response
        }
    
    async def _execute_skill_action(self, action: Dict) -> Dict[str, Any]:
        """Execute a skill based on parsed action"""
        
        skill_name = action.get("skill")
        parameters = action.get("parameters", {})
        
        # Find skill by name
        skills = await self.skills_manager.list_skills()
        skill = next((s for s in skills if s["name"] == skill_name), None)
        
        if not skill:
            return {"ok": False, "error": f"Skill '{skill_name}' not found"}
        
        # Execute skill
        result = await self.skills_manager.execute_skill(
            skill_id=skill["skill_id"],
            parameters=parameters,
            user_id=self.user_id
        )
        
        return result


# Factory function for creating agents
async def create_agent(
    user_id: str,
    provider: str = "openai",
    model: str = None,
    api_key: str = None,
    skills_manager: SkillsManager = None
) -> AutonomousAgent:
    """Create a new autonomous agent instance"""
    
    llm = OpenMindLLM(provider=provider, model=model, api_key=api_key)
    
    return AutonomousAgent(
        llm=llm,
        skills_manager=skills_manager,
        user_id=user_id
    )
```

**Add agent endpoint to `backend/server.py`:**

```python
@app.post("/api/agent/execute")
async def execute_agent_goal(
    goal: str = Body(...),
    context: Optional[str] = Body(default=None),
    provider: Optional[str] = Body(default="openai"),
    model: Optional[str] = Body(default=None),
    current_user: dict = Depends(get_current_user)
):
    """Execute an autonomous agent goal"""
    from backend.autonomous_agent import create_agent
    from backend.skills_manager import get_skills_manager
    
    sm = get_skills_manager()
    
    agent = await create_agent(
        user_id=current_user["user_id"],
        provider=provider,
        model=model,
        api_key=current_user.get("api_key"),
        skills_manager=sm
    )
    
    result = await agent.run_goal(goal=goal, context=context)
    
    return {"ok": True, "execution": result}
```

---

### Task 3.2: Connect Scheduler to Agent

**Update `backend/server.py` startup to wire scheduler + agent:**

```python
@app.on_event("startup")
async def startup_event():
    # ... existing startup code ...
    
    # Initialize scheduler WITH agent runner capability
    from backend.scheduler_manager import HeartbeatScheduler, scheduler as global_scheduler
    from backend.autonomous_agent import create_agent
    
    # Create agent factory function for scheduler
    async def agent_runner_factory(goal: str, user_id: str):
        """Factory that creates agent and runs goal"""
        from backend.skills_manager import get_skills_manager
        sm = get_skills_manager()
        
        # Get user's preferred LLM settings from DB
        user_doc = await db.users.find_one({"user_id": user_id})
        provider = user_doc.get("preferred_provider", "openai")
        model = user_doc.get("preferred_model")
        api_key = user_doc.get("api_key") or os.getenv("EMERGENT_LLM_KEY")
        
        agent = await create_agent(
            user_id=user_id,
            provider=provider,
            model=model,
            api_key=api_key,
            skills_manager=sm
        )
        
        return await agent.run_goal(goal=goal)
    
    # Create scheduler with agent runner
    global_scheduler.scheduler = HeartbeatScheduler(
        db=db,
        agent_runner=type('AgentRunner', (), {'run_goal': agent_runner_factory})()
    )
    
    logger.info("✅ Scheduler initialized with autonomous agent support")
```

---

## 📢 Phase 4: Notifications & Integrations

### Task 4.1: Add Notification Manager

**File:** `backend/notification_manager.py`

```python
"""Notification Manager - Multi-channel alerting (Discord, Telegram, Email)"""
import aiohttp
import os
from typing import Dict, Any, Optional
from datetime import datetime, timezone

class NotificationManager:
    """Send notifications to various channels"""
    
    def __init__(self):
        self.discord_webhook = os.getenv("DISCORD_WEBHOOK_URL")
        self.telegram_token = os.getenv("TELEGRAM_BOT_TOKEN")
        self.telegram_chat_id = os.getenv("TELEGRAM_CHAT_ID")
    
    async def send_notification(
        self,
        channel: str,
        message: str,
        title: Optional[str] = None,
        metadata: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Send notification to specified channel
        
        Args:
            channel: "discord", "telegram", "email", or "webhook"
            message: Notification message body
            title: Optional title/subject
            metadata: Additional channel-specific options
        
        Returns:
            Dict with delivery status
        """
        
        if channel == "discord":
            return await self._send_discord(message, title, metadata)
        elif channel == "telegram":
            return await self._send_telegram(message, title, metadata)
        elif channel == "webhook":
            return await self._send_webhook(message, title, metadata)
        else:
            return {"ok": False, "error": f"Unknown channel: {channel}"}
    
    async def _send_discord(
        self,
        message: str,
        title: Optional[str],
        metadata: Optional[Dict]
    ) -> Dict[str, Any]:
        """Send Discord webhook notification"""
        
        if not self.discord_webhook:
            return {"ok": False, "error": "DISCORD_WEBHOOK_URL not configured"}
        
        embed = {
            "title": title or "OpenMind Notification",
            "description": message,
            "color": 0xFF4500,  # OpenMind brand color
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "footer": {"text": "OpenMind Autonomous Agent"}
        }
        
        if metadata:
            fields = []
            for key, value in metadata.items():
                fields.append({"name": key, "value": str(value), "inline": True})
            embed["fields"] = fields
        
        payload = {"embeds": [embed]}
        
        async with aiohttp.ClientSession() as session:
            async with session.post(self.discord_webhook, json=payload) as response:
                if response.status == 204:
                    return {"ok": True, "channel": "discord"}
                else:
                    error_text = await response.text()
                    return {"ok": False, "error": error_text}
    
    async def _send_telegram(
        self,
        message: str,
        title: Optional[str],
        metadata: Optional[Dict]
    ) -> Dict[str, Any]:
        """Send Telegram bot message"""
        
        if not self.telegram_token or not self.telegram_chat_id:
            return {"ok": False, "error": "Telegram credentials not configured"}
        
        full_message = f"*{title}*\n\n{message}" if title else message
        
        if metadata:
            full_message += "\n\n" + "\n".join([f"_{k}_: `{v}`" for k, v in metadata.items()])
        
        url = f"https://api.telegram.org/bot{self.telegram_token}/sendMessage"
        payload = {
            "chat_id": self.telegram_chat_id,
            "text": full_message,
            "parse_mode": "Markdown"
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload) as response:
                if response.status == 200:
                    return {"ok": True, "channel": "telegram"}
                else:
                    error_text = await response.text()
                    return {"ok": False, "error": error_text}
    
    async def _send_webhook(
        self,
        message: str,
        title: Optional[str],
        metadata: Optional[Dict]
    ) -> Dict[str, Any]:
        """Send to custom webhook URL (from metadata)"""
        
        if not metadata or "webhook_url" not in metadata:
            return {"ok": False, "error": "webhook_url required in metadata"}
        
        webhook_url = metadata["webhook_url"]
        payload = {
            "title": title,
            "message": message,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "metadata": {k: v for k, v in metadata.items() if k != "webhook_url"}
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(webhook_url, json=payload) as response:
                if 200 <= response.status < 300:
                    return {"ok": True, "channel": "webhook"}
                else:
                    error_text = await response.text()
                    return {"ok": False, "error": error_text}


# Global instance
notification_manager: Optional[NotificationManager] = None


def get_notification_manager() -> NotificationManager:
    """Dependency injection helper"""
    global notification_manager
    if not notification_manager:
        notification_manager = NotificationManager()
    return notification_manager
```

**Add notification skill:**

**File:** `backend/skills/notifications.py`

```python
"""Notification Skills - Send alerts to various channels"""
from backend.notification_manager import get_notification_manager
from typing import Dict, Any, Optional

async def send_alert(
    channel: str,
    message: str,
    title: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Send notification alert to specified channel
    
    Args:
        channel: "discord", "telegram", or "webhook"
        message: Alert message
        title: Optional title
        metadata: Additional options (e.g., webhook_url for custom webhooks)
    
    Returns:
        Dict with delivery status
    """
    
    nm = get_notification_manager()
    result = await nm.send_notification(
        channel=channel,
        message=message,
        title=title,
        metadata=metadata
    )
    return result


# Skill metadata
NOTIFICATION_SKILLS = [
    {
        "name": "send_alert",
        "description": "Send notification to Discord, Telegram, or custom webhook",
        "category": "notifications",
        "handler": "backend.skills.notifications.send_alert",
        "parameters": {
            "channel": {
                "type": "string",
                "required": True,
                "description": "Notification channel: discord, telegram, or webhook"
            },
            "message": {
                "type": "string",
                "required": True,
                "description": "Alert message content"
            },
            "title": {
                "type": "string",
                "required": False,
                "description": "Alert title/subject"
            },
            "metadata": {
                "type": "object",
                "required": False,
                "description": "Additional options (webhook_url for webhooks)"
            }
        }
    }
]
```

**Register notification skills in startup (add to existing skill registration):**

```python
# In backend/server.py startup
from backend.skills.notifications import NOTIFICATION_SKILLS

all_skills = BROWSER_SKILLS + CRYPTO_SKILLS + NOTIFICATION_SKILLS
```

---

## ✅ Testing & Validation

### Test Script 1: Chat Integration

**File:** `tests/test_chat.py`

```python
"""Test chat integration"""
import asyncio
import aiohttp

async def test_chat():
    async with aiohttp.ClientSession() as session:
        # Replace with your actual session cookie
        headers = {"Cookie": "session=YOUR_SESSION_COOKIE"}
        
        # Test chat endpoint
        response = await session.post(
            "http://localhost:8000/api/chat/send",
            json={"message": "Hello OpenMind! What skills do you have?"},
            headers=headers
        )
        
        data = await response.json()
        print("Chat response:", data)
        
        assert data["ok"] == True
        assert "response" in data

if __name__ == "__main__":
    asyncio.run(test_chat())
```

---

### Test Script 2: Schedule Crypto Monitor

```python
"""Test scheduling a crypto price monitor"""
import asyncio
import aiohttp

async def test_schedule_crypto_monitor():
    async with aiohttp.ClientSession() as session:
        headers = {"Cookie": "session=YOUR_SESSION_COOKIE"}
        
        # Create scheduled job: Check ETH price every 5 minutes, alert Discord if < $3000
        response = await session.post(
            "http://localhost:8000/api/scheduler/create",
            json={
                "name": "ETH Price Monitor",
                "goal": "Check current Ethereum price. If price is below $3000 USD, send alert to Discord with the current price.",
                "cron": "*/5 * * * *",  # Every 5 minutes
                "enabled": True,
                "metadata": {
                    "discord_webhook": "YOUR_DISCORD_WEBHOOK_URL"
                }
            },
            headers=headers
        )
        
        data = await response.json()
        print("Scheduled job:", data)
        
        assert data["ok"] == True
        print(f"Job ID: {data['job_id']}")

if __name__ == "__main__":
    asyncio.run(test_schedule_crypto_monitor())
```

---

### Test Script 3: Execute Agent Goal

```python
"""Test autonomous agent execution"""
import asyncio
import aiohttp

async def test_agent_execution():
    async with aiohttp.ClientSession() as session:
        headers = {"Cookie": "session=YOUR_SESSION_COOKIE"}
        
        # Execute autonomous goal
        response = await session.post(
            "http://localhost:8000/api/agent/execute",
            json={
                "goal": "Find the current price of Bitcoin in USD and tell me if it's above $50,000",
                "provider": "openai",
                "model": "gpt-4"
            },
            headers=headers
        )
        
        data = await response.json()
        print("Agent execution:", data)
        
        # Print step-by-step execution log
        if data["ok"]:
            execution = data["execution"]
            print(f"\nGoal: {execution['goal']}")
            print(f"Status: {execution['status']}")
            print(f"\nSteps taken: {len(execution['steps'])}")
            for step in execution["steps"]:
                print(f"\nStep {step['step_number']}:")
                print(f"  Action: {step['action']}")
                if "skill_result" in step:
                    print(f"  Result: {step['skill_result']}")

if __name__ == "__main__":
    asyncio.run(test_agent_execution())
```

---

## 🚀 Deployment Checklist

### Environment Variables Required

Add to `.env` or Replit Secrets:

```bash
# LLM Providers
EMERGENT_LLM_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here  # Optional if using Anthropic
OPENAI_API_KEY=your_key_here     # Optional if using OpenAI

# Notifications
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# MongoDB
MONGODB_URI=mongodb://...

# Google Auth (already configured)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

### Install Additional Dependencies

```bash
pip install playwright apscheduler
playwright install chromium
```

### Database Collections to Create

MongoDB collections (auto-created but useful to know):
- `users` (existing)
- `user_sessions` (existing)
- `skills` (new)
- `skill_executions` (new)
- `scheduled_jobs` (new)
- `chat_history` (new)

---

## 📚 Example Use Cases

### Use Case 1: Automated GitHub PR Monitor

```json
{
  "name": "GitHub PR Monitor",
  "goal": "Check my GitHub repositories for new pull requests. For each new PR, generate a summary and post it to Discord.",
  "cron": "0 9 * * *"
}
```

### Use Case 2: TMM Puzzle Analyzer

```json
{
  "name": "TMM Subreddit Monitor",
  "goal": "Scrape r/takemymuffin for new posts. Extract any hex strings or encoded data. Run basic steganography checks. Log findings to MEMORY.md",
  "cron": "0 */6 * * *"
}
```

### Use Case 3: Portfolio Balance Alert

```json
{
  "name": "Wallet Balance Checker",
  "goal": "Check my Ethereum wallet 0x... balance. If balance changed by more than 0.1 ETH since last check, alert me on Telegram with transaction details.",
  "cron": "*/30 * * * *"
}
```

### Use Case 4: Multi-Agent Research

```json
{
  "goal": "Research the top 5 new meme coins launched in the past week. For each coin: scrape CoinGecko data, analyze tokenomics, check for rug pull indicators. Generate a ranked report and save to MEMORY.md",
  "provider": "anthropic",
  "model": "claude-4-sonnet-20250514"
}
```

---

## 🎯 Success Criteria

After completing all tasks, verify:

✅ **Chat works:** Send message via `/api/chat/send`, get LLM response  
✅ **Skills registered:** `/api/skills/list` returns browser, crypto, notification skills  
✅ **Skill execution:** Manually execute `get_crypto_price` via `/api/skills/execute`  
✅ **Agent reasoning:** Execute agent goal, see multi-step execution log  
✅ **Scheduler running:** Create cron job, verify it triggers every N minutes  
✅ **Notifications deliver:** Test Discord/Telegram webhook sends successfully  
✅ **Memory logging:** Check `~/openmind-workspace/MEMORY.md` for conversation logs  

---

## 📝 Notes for Kimi K2.5 & Z.ai GLM5

- **Kimi:** Focus on browser automation and crypto skills (your strength in web scraping)
- **GLM5:** Handle LLM integration, agent reasoning logic, and scheduler orchestration
- **Collaboration:** Kimi builds skills layer, GLM5 wires agent → scheduler → skills pipeline
- **Testing:** Each agent should run their respective test scripts after implementation
- **Commit strategy:** Make incremental commits for each phase (Phase 1 → commit, Phase 2 → commit, etc.)

---

## 🔄 Iterative Enhancement

After core implementation, consider:
1. Add vector embeddings to memory for semantic search
2. Implement skill dependency resolution (skill X requires skill Y)
3. Add agent self-improvement (agent analyzes failed executions and suggests new skills)
4. Multi-agent collaboration (research agent → coding agent → review agent pipeline)
5. Web UI dashboards for agent execution logs and scheduler management

---

**Last Updated:** 2026-02-20  
**Maintained By:** dicacid  
**Target Agents:** Kimi K2.5, Z.ai GLM5
