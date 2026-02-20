"""Skills Manager - handles skill installation and configuration"""
from datetime import datetime, timezone
from typing import Optional, Dict, Any

def create_skill_document(skill_id: str, config: Optional[Dict[str, Any]] = None) -> dict:
    """Create a skill document for MongoDB"""
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
