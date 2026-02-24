"""
Email service abstraction layer.
Supports multiple providers: Mailgun, SendGrid, MockEmailService for testing.
"""

import os
import logging
from abc import ABC, abstractmethod
from typing import Optional
import json

logger = logging.getLogger(__name__)


class EmailService(ABC):
    """Abstract base class for email services."""

    @abstractmethod
    async def send_verification_code(
        self,
        email: str,
        code: str,
        expires_in_minutes: int = 10
    ) -> bool:
        """
        Send a verification code email.

        Args:
            email: Recipient email address
            code: 6-digit verification code
            expires_in_minutes: How long the code is valid (for UI display)

        Returns:
            True if sent successfully, False otherwise
        """
        pass

    @abstractmethod
    async def send_welcome(self, email: str, name: str) -> bool:
        """
        Send a welcome email after successful verification.

        Args:
            email: Recipient email address
            name: User's name

        Returns:
            True if sent successfully, False otherwise
        """
        pass


class MailgunEmailService(EmailService):
    """Mailgun email provider implementation."""

    def __init__(self):
        self.api_key = os.environ.get("MAILGUN_API_KEY")
        self.domain = os.environ.get("MAILGUN_DOMAIN")
        self.from_email = os.environ.get("MAILGUN_FROM_EMAIL", f"noreply@{self.domain}")

        if not self.api_key or not self.domain:
            raise ValueError("MAILGUN_API_KEY and MAILGUN_DOMAIN must be set")

    async def send_verification_code(
        self,
        email: str,
        code: str,
        expires_in_minutes: int = 10
    ) -> bool:
        """Send verification code via Mailgun."""
        try:
            import requests
            from requests.auth import HTTPBasicAuth

            subject = "Your OpenMind Login Code"
            text = f"""Your OpenMind login code is: {code}

This code expires in {expires_in_minutes} minutes.

If you didn't request this code, please ignore this email.
"""

            response = requests.post(
                f"https://api.mailgun.net/v3/{self.domain}/messages",
                auth=HTTPBasicAuth("api", self.api_key),
                data={
                    "from": self.from_email,
                    "to": email,
                    "subject": subject,
                    "text": text
                },
                timeout=10
            )

            if response.status_code == 200:
                logger.info(f"Verification code sent to {email}")
                return True
            else:
                logger.error(f"Mailgun error ({response.status_code}): {response.text}")
                return False

        except Exception as e:
            logger.error(f"Failed to send verification code to {email}: {str(e)}")
            return False

    async def send_welcome(self, email: str, name: str) -> bool:
        """Send welcome email via Mailgun."""
        try:
            import requests
            from requests.auth import HTTPBasicAuth

            subject = "Welcome to OpenMind"
            text = f"""Hi {name},

Welcome to OpenMind! Your account is now active.

You can log in anytime using your email address.

Best regards,
The OpenMind Team
"""

            response = requests.post(
                f"https://api.mailgun.net/v3/{self.domain}/messages",
                auth=HTTPBasicAuth("api", self.api_key),
                data={
                    "from": self.from_email,
                    "to": email,
                    "subject": subject,
                    "text": text
                },
                timeout=10
            )

            if response.status_code == 200:
                logger.info(f"Welcome email sent to {email}")
                return True
            else:
                logger.error(f"Mailgun error ({response.status_code}): {response.text}")
                return False

        except Exception as e:
            logger.error(f"Failed to send welcome email to {email}: {str(e)}")
            return False


class MockEmailService(EmailService):
    """Mock email service for testing and development."""

    def __init__(self):
        self.sent_emails = []

    async def send_verification_code(
        self,
        email: str,
        code: str,
        expires_in_minutes: int = 10
    ) -> bool:
        """Mock: Store email in memory."""
        self.sent_emails.append({
            "to": email,
            "type": "verification_code",
            "code": code,
            "expires_in_minutes": expires_in_minutes
        })
        logger.info(f"[MOCK] Verification code sent to {email}: {code}")
        return True

    async def send_welcome(self, email: str, name: str) -> bool:
        """Mock: Store email in memory."""
        self.sent_emails.append({
            "to": email,
            "type": "welcome",
            "name": name
        })
        logger.info(f"[MOCK] Welcome email sent to {email}")
        return True

    def get_last_code_for_email(self, email: str) -> Optional[str]:
        """Get the last verification code sent to an email (for testing)."""
        for msg in reversed(self.sent_emails):
            if msg.get("to") == email and msg.get("type") == "verification_code":
                return msg.get("code")
        return None


class SendGridEmailService(EmailService):
    """SendGrid email provider implementation."""

    def __init__(self):
        self.api_key = os.environ.get("SENDGRID_API_KEY")

        if not self.api_key:
            raise ValueError("SENDGRID_API_KEY must be set")

        self.from_email = os.environ.get("SENDGRID_FROM_EMAIL", "noreply@openmind.ai")

    async def send_verification_code(
        self,
        email: str,
        code: str,
        expires_in_minutes: int = 10
    ) -> bool:
        """Send verification code via SendGrid."""
        try:
            from sendgrid import SendGridAPIClient
            from sendgrid.helpers.mail import Mail

            message = Mail(
                from_email=self.from_email,
                to_emails=email,
                subject="Your OpenMind Login Code",
                plain_text_content=f"""Your OpenMind login code is: {code}

This code expires in {expires_in_minutes} minutes.

If you didn't request this code, please ignore this email.
"""
            )

            sg = SendGridAPIClient(self.api_key)
            response = sg.send(message)

            if response.status_code == 202:
                logger.info(f"Verification code sent to {email}")
                return True
            else:
                logger.error(f"SendGrid error ({response.status_code}): {response.body}")
                return False

        except Exception as e:
            logger.error(f"Failed to send verification code to {email}: {str(e)}")
            return False

    async def send_welcome(self, email: str, name: str) -> bool:
        """Send welcome email via SendGrid."""
        try:
            from sendgrid import SendGridAPIClient
            from sendgrid.helpers.mail import Mail

            message = Mail(
                from_email=self.from_email,
                to_emails=email,
                subject="Welcome to OpenMind",
                plain_text_content=f"""Hi {name},

Welcome to OpenMind! Your account is now active.

You can log in anytime using your email address.

Best regards,
The OpenMind Team
"""
            )

            sg = SendGridAPIClient(self.api_key)
            response = sg.send(message)

            if response.status_code == 202:
                logger.info(f"Welcome email sent to {email}")
                return True
            else:
                logger.error(f"SendGrid error ({response.status_code}): {response.body}")
                return False

        except Exception as e:
            logger.error(f"Failed to send welcome email to {email}: {str(e)}")
            return False


def get_email_service() -> EmailService:
    """
    Factory function to get the configured email service.
    Respects EMAIL_PROVIDER env var (mailgun, sendgrid, mock).
    Defaults to mock if not set.
    """
    provider = os.environ.get("EMAIL_PROVIDER", "mock").lower()

    if provider == "mailgun":
        return MailgunEmailService()
    elif provider == "sendgrid":
        return SendGridEmailService()
    elif provider == "mock":
        return MockEmailService()
    else:
        logger.warning(f"Unknown EMAIL_PROVIDER: {provider}, using mock")
        return MockEmailService()
