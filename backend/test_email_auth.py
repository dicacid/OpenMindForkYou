"""
Tests for email authentication system.
Includes tests for code generation, rate limiting, and email service.
"""

import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from bson import ObjectId

# Import the modules to test
from code_generator import (
    generate_verification_code,
    request_code_rate_limit,
    verify_code_rate_limit,
    record_verification_attempt,
    resend_code_rate_limit,
    cleanup_expired_codes,
    get_pending_code
)
from email_service import (
    MailgunEmailService,
    MockEmailService,
    SendGridEmailService,
    get_email_service
)


class TestCodeGeneration:
    """Tests for verification code generation."""

    def test_code_is_six_digits(self):
        """Generated code should always be 6 digits."""
        for _ in range(100):
            code = generate_verification_code()
            assert len(code) == 6
            assert code.isdigit()

    def test_code_is_random(self):
        """Generated codes should be random."""
        codes = {generate_verification_code() for _ in range(100)}
        # With 1 million combinations, collision probability is extremely low
        assert len(codes) >= 99


class TestRateLimiting:
    """Tests for rate limiting functionality."""

    @pytest.mark.asyncio
    async def test_request_code_rate_limit_allows_initial_request(self):
        """First code request should always be allowed."""
        mock_db = AsyncMock()
        mock_db.email_verification_codes.count_documents = AsyncMock(return_value=0)

        allowed, retry_after = await request_code_rate_limit(
            mock_db, "test@example.com", max_requests=3, window_minutes=15
        )

        assert allowed is True
        assert retry_after is None

    @pytest.mark.asyncio
    async def test_request_code_rate_limit_blocks_excess_requests(self):
        """Should block requests exceeding the limit."""
        mock_db = AsyncMock()
        mock_db.email_verification_codes.count_documents = AsyncMock(return_value=3)

        now = datetime.now(timezone.utc)
        old_code = {"created_at": now - timedelta(minutes=5)}
        mock_db.email_verification_codes.find_one = AsyncMock(return_value=old_code)

        allowed, retry_after = await request_code_rate_limit(
            mock_db, "test@example.com", max_requests=3, window_minutes=15
        )

        assert allowed is False
        assert retry_after is not None
        assert retry_after > 0

    @pytest.mark.asyncio
    async def test_verify_code_rate_limit_allows_initial_attempt(self):
        """First verification attempt should be allowed."""
        mock_db = AsyncMock()
        code_doc = {"_id": ObjectId(), "attempt_count": 0}
        mock_db.email_verification_codes.find_one = AsyncMock(return_value=code_doc)

        allowed, attempts_remaining = await verify_code_rate_limit(
            mock_db, code_doc["_id"], max_attempts=5
        )

        assert allowed is True
        assert attempts_remaining == 4

    @pytest.mark.asyncio
    async def test_verify_code_rate_limit_blocks_after_max_attempts(self):
        """Should block verification after max attempts."""
        mock_db = AsyncMock()
        code_doc = {"_id": ObjectId(), "attempt_count": 5}
        mock_db.email_verification_codes.find_one = AsyncMock(return_value=code_doc)

        allowed, attempts_remaining = await verify_code_rate_limit(
            mock_db, code_doc["_id"], max_attempts=5
        )

        assert allowed is False
        assert attempts_remaining == 0

    @pytest.mark.asyncio
    async def test_resend_code_rate_limit(self):
        """Resend rate limit should be more restrictive than initial request."""
        mock_db = AsyncMock()

        # Simulate 2 existing codes for this email
        codes = [{"created_at": datetime.now(timezone.utc)}] * 2
        mock_db.email_verification_codes.find = AsyncMock()
        mock_db.email_verification_codes.find.return_value.to_list = AsyncMock(return_value=codes)

        allowed, retry_after = await resend_code_rate_limit(
            mock_db, "test@example.com", max_resends=2, window_minutes=5
        )

        # Second resend (3rd total) should be blocked
        assert allowed is False
        assert retry_after is not None


class TestEmailService:
    """Tests for email service implementations."""

    def test_mock_email_service_stores_code(self):
        """Mock service should store sent codes in memory."""
        service = MockEmailService()
        assert service.send_verification_code("test@example.com", "123456", 10) is not None
        assert service.get_last_code_for_email("test@example.com") == "123456"

    def test_mock_email_service_multiple_codes(self):
        """Mock service should track multiple codes."""
        service = MockEmailService()
        service.send_verification_code("test1@example.com", "111111", 10)
        service.send_verification_code("test2@example.com", "222222", 10)
        service.send_verification_code("test1@example.com", "333333", 10)

        assert service.get_last_code_for_email("test1@example.com") == "333333"
        assert service.get_last_code_for_email("test2@example.com") == "222222"

    def test_get_email_service_returns_mock_by_default(self):
        """get_email_service should return MockEmailService by default."""
        with patch.dict('os.environ', {'EMAIL_PROVIDER': 'mock'}):
            service = get_email_service()
            assert isinstance(service, MockEmailService)

    @patch.dict('os.environ', {'MAILGUN_API_KEY': 'test-key', 'MAILGUN_DOMAIN': 'test.com'})
    def test_mailgun_email_service_initialization(self):
        """Mailgun service should be configured with env vars."""
        service = MailgunEmailService()
        assert service.api_key == 'test-key'
        assert service.domain == 'test.com'

    def test_mailgun_email_service_missing_config(self):
        """Mailgun service should raise error without config."""
        with patch.dict('os.environ', {}, clear=True):
            with pytest.raises(ValueError):
                MailgunEmailService()


@pytest.mark.asyncio
async def test_cleanup_expired_codes():
    """Cleanup function should delete expired codes."""
    mock_db = AsyncMock()
    mock_delete_result = AsyncMock()
    mock_delete_result.deleted_count = 42
    mock_db.email_verification_codes.delete_many = AsyncMock(return_value=mock_delete_result)

    deleted = await cleanup_expired_codes(mock_db)

    assert deleted == 42
    mock_db.email_verification_codes.delete_many.assert_called_once()


@pytest.mark.asyncio
async def test_get_pending_code():
    """get_pending_code should return non-verified, non-expired code."""
    mock_db = AsyncMock()
    expected_code = {"_id": ObjectId(), "code": "123456", "email": "test@example.com"}
    mock_db.email_verification_codes.find_one = AsyncMock(return_value=expected_code)

    code = await get_pending_code(mock_db, "test@example.com")

    assert code == expected_code
    mock_db.email_verification_codes.find_one.assert_called_once()


@pytest.mark.asyncio
async def test_record_verification_attempt():
    """Record verification attempt should update attempt_count."""
    mock_db = AsyncMock()
    code_id = ObjectId()

    await record_verification_attempt(mock_db, code_id, success=False)

    mock_db.email_verification_codes.update_one.assert_called_once()
    call_args = mock_db.email_verification_codes.update_one.call_args
    assert call_args[0][0] == {"_id": code_id}
    assert "$inc" in call_args[0][1]
    assert call_args[0][1]["$inc"]["attempt_count"] == 1
