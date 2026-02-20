"""Heartbeat Scheduler - manages scheduled jobs and executions"""
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from croniter import croniter
import re

def parse_cron_to_human(cron_expression: str) -> str:
    """Convert cron expression to human-readable format"""
    try:
        parts = cron_expression.strip().split()
        if len(parts) != 5:
            return "Invalid cron expression"
        
        minute, hour, day, month, weekday = parts
        
        # Common patterns
        if cron_expression == "0 * * * *":
            return "Every hour"
        if cron_expression == "0 8 * * *":
            return "Every day at 8:00 AM"
        if cron_expression == "0 20 * * *":
            return "Every day at 8:00 PM"
        if cron_expression == "0 8 * * 1":
            return "Every Monday at 8:00 AM"
        if cron_expression == "*/15 * * * *":
            return "Every 15 minutes"
        if cron_expression == "0 0 * * *":
            return "Every day at midnight"
        if cron_expression == "0 12 * * *":
            return "Every day at noon"
        
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
        return f"Invalid cron: {str(e)}"

def get_next_run_time(cron_expression: str) -> Optional[str]:
    """Get the next run time for a cron expression"""
    try:
        base_time = datetime.now(timezone.utc)
        cron = croniter(cron_expression, base_time)
        next_run = cron.get_next(datetime)
        return next_run.isoformat()
    except Exception:
        return None

def validate_cron(cron_expression: str) -> bool:
    """Validate a cron expression"""
    try:
        croniter(cron_expression)
        return True
    except Exception:
        return False

def create_job_document(name: str, cron: str, prompt: str, channel: str, active: bool = True) -> dict:
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

def create_execution_log(job_id: str, job_name: str, status: str, output: str) -> dict:
    """Create an execution log document"""
    return {
        "job_id": job_id,
        "job_name": job_name,
        "status": status,
        "output": output,
        "executed_at": datetime.now(timezone.utc)
    }
