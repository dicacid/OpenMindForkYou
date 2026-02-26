"""Heartbeat Scheduler - manages scheduled jobs and executions"""
import signal
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from croniter import croniter
import re
import logging

logger = logging.getLogger(__name__)

CRON_PRESETS: Dict[str, str] = {
    "0 * * * *": "Every hour",
    "0 8 * * *": "Every day at 8:00 AM",
    "0 20 * * *": "Every day at 8:00 PM",
    "0 8 * * 1": "Every Monday at 8:00 AM",
    "*/15 * * * *": "Every 15 minutes",
    "0 0 * * *": "Every day at midnight",
    "0 12 * * *": "Every day at noon"
}

@contextmanager
def timeout(seconds: int):
    def signal_handler(signum, frame):
        raise TimeoutError("Cron validation timeout")
    signal.signal(signal.SIGALRM, signal_handler)
    signal.alarm(seconds)
    try:
        yield
    finally:
        signal.alarm(0)

def parse_cron_to_human(cron_expression: str) -> str:
    """Convert cron expression to human-readable format"""
    try:
        parts = cron_expression.strip().split()
        if len(parts) != 5:
            return "Invalid cron expression"
        
        minute, hour, day, month, weekday = parts
        
        # Common patterns
        if cron_expression in CRON_PRESETS:
            return CRON_PRESETS[cron_expression]
        
        # Build description
        parts_desc = []
        
        # Minute
        if minute == "*":
            pass
        elif minute.startswith("*/"):
            parts_desc.append(f"every {minute[2:]} minutes")
        else:
            parts_desc.append(f"at minute {minute}")
        
        # Hour
        if hour == "*":
            if minute != "*":
                parts_desc.append("every hour")
        elif hour.startswith("*/"):
            parts_desc.append(f"every {hour[2:]} hours")
        else:
            hour_int = int(hour)
            am_pm = "AM" if hour_int < 12 else "PM"
            hour_12 = hour_int if hour_int <= 12 else hour_int - 12
            if hour_12 == 0:
                hour_12 = 12
            parts_desc.append(f"at {hour_12}:00 {am_pm}")
        
        # Day
        if day == "*":
            if hour != "*" or minute != "*":
                parts_desc.append("every day")
        elif day.startswith("*/"):
            parts_desc.append(f"every {day[2:]} days")
        else:
            parts_desc.append(f"on day {day} of month")
        
        # Weekday
        if weekday != "*":
            weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
            if weekday.isdigit():
                parts_desc.append(f"on {weekdays[int(weekday)]}")
        
        return " ".join(parts_desc).capitalize() if parts_desc else "Custom schedule"
    except Exception as e:
        logger.warning(f"Error parsing cron to human: {str(e)}")
        return f"Invalid cron: {str(e)}"

def get_next_run_time(cron_expression: str) -> Optional[str]:
    """Get the next run time for a cron expression"""
    try:
        base_time = datetime.now(timezone.utc)
        cron = croniter(cron_expression, base_time)
        next_run = cron.get_next(datetime)
        return next_run.isoformat()
    except (ValueError, KeyError) as e:
        logger.warning(f"Failed to get next run time for '{cron_expression}': {e}")
        return None

def validate_cron(cron_expression: str, timeout_seconds: int = 2) -> bool:
    """Validate a cron expression"""
    try:
        with timeout(timeout_seconds):
            croniter(cron_expression)
        return True
    except TimeoutError:
        logger.error("Cron validation timed out")
        return False
    except (ValueError, KeyError):
        return False
    except Exception as e:
        logger.error(f"Unexpected error validating cron: {e}")
        return False

def create_job_document(name: str, cron: str, prompt: str, channel: str, active: bool = True) -> Dict[str, Any]:
    """Create a job document for MongoDB"""
    now = datetime.now(timezone.utc)
    return {
        "name": name,
        "cron_expression": cron,
        "prompt": prompt,
        "delivery_channel": channel,
        "active": active,
        "created_at": now,
        "updated_at": now,
        "last_run_at": None,
        "last_run_status": None,
        "next_run_at": get_next_run_time(cron)
    }

def create_execution_log(job_id: str, job_name: str, status: str, output: str) -> Dict[str, Any]:
    """Create an execution log document"""
    return {
        "job_id": job_id,
        "job_name": job_name,
        "status": status,
        "output": output,
        "executed_at": datetime.now(timezone.utc)
    }