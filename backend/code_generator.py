"""
Email verification code generation, validation, and rate limiting utilities.
"""

import secrets
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)


def generate_verification_code() -> str:
    """Generate a secure 6-digit verification code."""
    # Generate 3 random bytes (24 bits) and convert to 6-digit number
    random_bytes = secrets.token_bytes(3)
    # Convert bytes to integer, then to 6-digit string with leading zeros if needed
    num = int.from_bytes(random_bytes, byteorder='big')
    code = str(num % 1000000).zfill(6)
    return code


async def request_code_rate_limit(
    db: AsyncIOMotorDatabase,
    email: str,
    max_requests: int = 3,
    window_minutes: int = 15
) -> Tuple[bool, Optional[int]]:
    """
    Check if email can request a new code.

    Args:
        db: MongoDB database instance
        email: Email address requesting code
        max_requests: Max requests allowed in window
        window_minutes: Time window in minutes

    Returns:
        Tuple of (allowed: bool, retry_after_seconds: Optional[int])
        - (True, None) if allowed
        - (False, retry_seconds) if rate limited
    """
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(minutes=window_minutes)

    # Count requests in the time window
    count = await db.email_verification_codes.count_documents({
        "email": email.lower(),
        "created_at": {"$gte": window_start}
    })

    if count >= max_requests:
        # Find oldest request in window to calculate retry time
        oldest = await db.email_verification_codes.find_one(
            {
                "email": email.lower(),
                "created_at": {"$gte": window_start}
            },
            sort=[("created_at", 1)]
        )

        if oldest:
            retry_at = oldest["created_at"] + timedelta(minutes=window_minutes)
            retry_after = int((retry_at - now).total_seconds())
            return False, max(1, retry_after)

    return True, None


async def verify_code_rate_limit(
    db: AsyncIOMotorDatabase,
    code_id: str,
    max_attempts: int = 5
) -> Tuple[bool, Optional[int]]:
    """
    Check if a verification code can be verified.

    Args:
        db: MongoDB database instance
        code_id: MongoDB ObjectId of the code document
        max_attempts: Max verification attempts allowed

    Returns:
        Tuple of (allowed: bool, attempts_remaining: Optional[int])
        - (True, attempts_left) if allowed to attempt
        - (False, 0) if locked (too many attempts)
    """
    code_doc = await db.email_verification_codes.find_one({"_id": code_id})

    if not code_doc:
        return False, None

    attempts = code_doc.get("attempt_count", 0)

    if attempts >= max_attempts:
        return False, 0

    attempts_remaining = max_attempts - attempts - 1
    return True, attempts_remaining


async def record_verification_attempt(
    db: AsyncIOMotorDatabase,
    code_id: str,
    success: bool
) -> None:
    """
    Record a verification attempt for a code.

    Args:
        db: MongoDB database instance
        code_id: MongoDB ObjectId of the code document
        success: Whether the attempt was successful
    """
    await db.email_verification_codes.update_one(
        {"_id": code_id},
        {
            "$inc": {"attempt_count": 1},
            "$set": {"last_attempt_at": datetime.now(timezone.utc)}
        }
    )


async def resend_code_rate_limit(
    db: AsyncIOMotorDatabase,
    email: str,
    max_resends: int = 2,
    window_minutes: int = 5
) -> Tuple[bool, Optional[int]]:
    """
    Check if email can resend a code (more restrictive than initial request).

    Args:
        db: MongoDB database instance
        email: Email address requesting resend
        max_resends: Max resends allowed in window
        window_minutes: Time window in minutes

    Returns:
        Tuple of (allowed: bool, retry_after_seconds: Optional[int])
        - (True, None) if allowed
        - (False, retry_seconds) if rate limited
    """
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(minutes=window_minutes)

    # Count resends in the time window (resends = multiple codes for same email)
    codes = await db.email_verification_codes.find(
        {
            "email": email.lower(),
            "created_at": {"$gte": window_start}
        },
        sort=[("created_at", -1)]
    ).to_list(None)

    # Resend count = total codes minus 1 (the original request)
    resend_count = max(0, len(codes) - 1)

    if resend_count >= max_resends:
        # Find oldest code in window
        if codes:
            oldest = codes[-1]  # Last one in reverse sort
            retry_at = oldest["created_at"] + timedelta(minutes=window_minutes)
            retry_after = int((retry_at - now).total_seconds())
            return False, max(1, retry_after)

    return True, None


async def cleanup_expired_codes(db: AsyncIOMotorDatabase) -> int:
    """
    Delete expired verification codes from database.
    Should be called periodically or via TTL index (recommended).

    Args:
        db: MongoDB database instance

    Returns:
        Number of codes deleted
    """
    now = datetime.now(timezone.utc)
    result = await db.email_verification_codes.delete_many({
        "expires_at": {"$lt": now}
    })
    return result.deleted_count


async def get_pending_code(
    db: AsyncIOMotorDatabase,
    email: str
) -> Optional[dict]:
    """
    Get an unverified, non-expired code for an email.

    Args:
        db: MongoDB database instance
        email: Email address

    Returns:
        Code document or None
    """
    now = datetime.now(timezone.utc)
    code_doc = await db.email_verification_codes.find_one({
        "email": email.lower(),
        "verified": False,
        "expires_at": {"$gt": now}
    })
    return code_doc
