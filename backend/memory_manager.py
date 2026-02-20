"""Memory Manager - handles MEMORY.md and SOUL.md file operations"""
from pathlib import Path
import os
from datetime import datetime, timezone
from typing import Optional
import re

WORKSPACE_DIR = os.path.expanduser("~/clawd")
MEMORY_FILE = os.path.join(WORKSPACE_DIR, "MEMORY.md")
SOUL_FILE = os.path.join(WORKSPACE_DIR, "SOUL.md")

DEFAULT_SOUL_TEMPLATE = """# MoltBot Personality

## Core Identity
You are MoltBot, a helpful AI assistant with a friendly and professional demeanor.

## Communication Style
- Be clear and concise
- Use friendly, conversational language
- Adapt tone based on user preference
- Be proactive in offering help

## Values
- Prioritize user needs
- Maintain transparency
- Respect privacy and boundaries
- Continuously learn and improve

## Capabilities
- Natural conversation
- Task assistance
- Information retrieval
- Creative problem-solving
"""

def ensure_workspace_exists():
    """Ensure workspace directory exists"""
    os.makedirs(WORKSPACE_DIR, exist_ok=True)

def get_memory_content() -> str:
    """Get current MEMORY.md content"""
    ensure_workspace_exists()
    if os.path.exists(MEMORY_FILE):
        with open(MEMORY_FILE, 'r', encoding='utf-8') as f:
            return f.read()
    return "# Memory\n\nNo memories yet.\n"

def get_soul_content() -> str:
    """Get current SOUL.md content"""
    ensure_workspace_exists()
    if os.path.exists(SOUL_FILE):
        with open(SOUL_FILE, 'r', encoding='utf-8') as f:
            return f.read()
    return DEFAULT_SOUL_TEMPLATE

def save_memory_content(content: str) -> dict:
    """Save MEMORY.md content"""
    ensure_workspace_exists()
    with open(MEMORY_FILE, 'w', encoding='utf-8') as f:
        f.write(content)
    
    stats = get_file_stats(content)
    return {
        "ok": True,
        "stats": stats,
        "last_modified": datetime.now(timezone.utc).isoformat()
    }

def save_soul_content(content: str) -> dict:
    """Save SOUL.md content"""
    ensure_workspace_exists()
    with open(SOUL_FILE, 'w', encoding='utf-8') as f:
        f.write(content)
    
    stats = get_file_stats(content)
    return {
        "ok": True,
        "stats": stats,
        "last_modified": datetime.now(timezone.utc).isoformat()
    }

def get_file_stats(content: str) -> dict:
    """Calculate file statistics"""
    words = len(content.split())
    chars = len(content)
    tokens = chars // 4  # Rough estimate: 1 token ≈ 4 chars
    lines = len(content.split('\n'))
    
    return {
        "words": words,
        "characters": chars,
        "tokens": tokens,
        "lines": lines
    }

def get_last_modified(file_path: str) -> Optional[str]:
    """Get last modified time of a file"""
    if os.path.exists(file_path):
        timestamp = os.path.getmtime(file_path)
        dt = datetime.fromtimestamp(timestamp, tz=timezone.utc)
        return dt.isoformat()
    return None

def add_memory_entry(entry_type: str, content: str) -> str:
    """Add a new entry to MEMORY.md"""
    current = get_memory_content()
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    
    # Create formatted entry based on type
    if entry_type == "fact":
        new_entry = f"\n## Fact - {timestamp}\n{content}\n"
    elif entry_type == "preference":
        new_entry = f"\n## Preference - {timestamp}\n{content}\n"
    elif entry_type == "project":
        new_entry = f"\n## Project - {timestamp}\n{content}\n"
    else:
        new_entry = f"\n## {entry_type.title()} - {timestamp}\n{content}\n"
    
    # Append to end of file
    updated = current.rstrip() + "\n" + new_entry
    save_memory_content(updated)
    return updated

def clear_memory_section(section_type: str) -> str:
    """Clear all entries of a specific type from MEMORY.md"""
    current = get_memory_content()
    
    # Remove sections matching the type
    pattern = rf"## {section_type.title()}[^#]*(?=##|$)"
    updated = re.sub(pattern, "", current, flags=re.IGNORECASE)
    
    # Clean up extra whitespace
    updated = re.sub(r'\n{3,}', '\n\n', updated)
    
    save_memory_content(updated)
    return updated

def reset_soul_to_default() -> str:
    """Reset SOUL.md to default template"""
    save_soul_content(DEFAULT_SOUL_TEMPLATE)
    return DEFAULT_SOUL_TEMPLATE
