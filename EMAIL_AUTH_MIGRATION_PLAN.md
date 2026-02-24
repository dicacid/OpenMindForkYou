# Email Code-Based Authentication Migration Plan

**Status:** DRAFT FOR APPROVAL
**Date:** 2026-02-23
**Target Timeline:** 3-4 days

---

## Executive Summary

This plan details the complete migration from **Emergent OAuth** to a **self-hosted email code-based authentication** system for OpenMind.

### What Changes
- ❌ Remove: Emergent Auth integration
- ✅ Add: Email-based verification codes
- ✅ Keep: Same session management, instance locking, MongoDB storage

### Key Benefits
- No external auth service dependency
- Faster iterations on auth features
- Complete control over user flow
- Better email deliverability (SendGrid/Mailgun)

---

## Phase 0: Preparation (Before Implementation)

### 0.1 Choose Email Service Provider

**Recommended: SendGrid** (Twilio subsidiary)
- Free tier: 100 emails/day
- Reliable, industry standard
- Good documentation
- Python library: `sendgrid`

**Alternative: Mailgun** (also good)
- Slightly cheaper at scale
- Python library: `requests`

**DIY Option: SMTP** (lowest cost, highest complexity)
- Use own SMTP server (AWS SES, local postfix)
- Requires more infrastructure

**Recommendation:** Start with **SendGrid Free Tier**

### 0.2 Environment Variables Needed
```env
# Email Service
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
SENDGRID_FROM_EMAIL=noreply@yourdomain.com

# Auth Config
EMAIL_CODE_EXPIRY_MINUTES=15
EMAIL_CODE_LENGTH=6
MAX_EMAIL_ATTEMPTS_PER_HOUR=5
SESSION_EXPIRY_DAYS=7
```

### 0.3 Database Schema Changes

**New Collection:** `email_verification_codes`
```python
{
    "_id": ObjectId,
    "email": "user@example.com",
    "code": "123456",  # 6-digit code
    "created_at": datetime,
    "expires_at": datetime,  # created_at + 15 minutes
    "verified": False,
    "attempts": 0,
    "ip_address": "192.168.1.1"  # For rate limiting
}
```

**Existing Collections - No Changes:**
- `users` - Keep as-is
- `user_sessions` - Keep as-is
- `instance_config` - Keep as-is

---

## Phase 1: Backend Implementation

### 1.1 New Dependencies

```bash
pip install sendgrid python-dotenv
```

**Or for Mailgun:**
```bash
pip install mailgun-python
```

### 1.2 Create Email Service Module

**File:** `backend/email_service.py`

```python
"""Email service for sending verification codes"""
import os
import logging
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content

logger = logging.getLogger(__name__)

class EmailService:
    def __init__(self):
        self.sg = SendGridAPIClient(os.environ.get('SENDGRID_API_KEY'))
        self.from_email = os.environ.get('SENDGRID_FROM_EMAIL', 'noreply@openmind.local')

    async def send_verification_code(self, email: str, code: str) -> bool:
        """Send verification code via email"""
        try:
            message = Mail(
                from_email=self.from_email,
                to_emails=email,
                subject='Your OpenMind Verification Code',
                html_content=self._get_email_html(code)
            )

            response = self.sg.send(message)
            logger.info(f"Email sent to {email}, status: {response.status_code}")
            return response.status_code in (200, 201, 202)
        except Exception as e:
            logger.error(f"Failed to send email to {email}: {e}")
            return False

    def _get_email_html(self, code: str) -> str:
        """Generate HTML email content"""
        return f"""
        <html>
            <body style="font-family: Arial, sans-serif; background-color: #f5f5f5;">
                <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 20px; border-radius: 8px;">
                    <h2 style="color: #333;">OpenMind Verification Code</h2>
                    <p style="color: #666;">Your verification code is:</p>
                    <div style="background-color: #f0f0f0; padding: 20px; border-radius: 4px; text-align: center; margin: 20px 0;">
                        <span style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #FF4500;">{code}</span>
                    </div>
                    <p style="color: #999; font-size: 12px;">This code expires in 15 minutes.</p>
                    <p style="color: #999; font-size: 12px;">If you didn't request this code, you can safely ignore this email.</p>
                </div>
            </body>
        </html>
        """

email_service = EmailService()
```

### 1.3 Create Auth Service Module

**File:** `backend/auth_service.py`

```python
"""Authentication service for email code verification"""
import secrets
import os
import logging
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

class AuthService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.code_length = int(os.getenv('EMAIL_CODE_LENGTH', 6))
        self.code_expiry_minutes = int(os.getenv('EMAIL_CODE_EXPIRY_MINUTES', 15))
        self.max_attempts = int(os.getenv('MAX_EMAIL_ATTEMPTS_PER_HOUR', 5))

    async def send_verification_code(self, email: str, ip_address: str) -> dict:
        """
        Send verification code to email.
        Implements rate limiting (5 codes per hour per IP)
        """
        # Check rate limit
        hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
        recent_codes = await self.db.email_verification_codes.count_documents({
            "ip_address": ip_address,
            "created_at": {"$gte": hour_ago}
        })

        if recent_codes >= self.max_attempts:
            return {
                "ok": False,
                "error": "Too many verification attempts. Please try again later."
            }

        # Generate code
        code = ''.join(secrets.choice('0123456789') for _ in range(self.code_length))
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=self.code_expiry_minutes)

        # Store code in database
        await self.db.email_verification_codes.insert_one({
            "email": email.lower(),
            "code": code,
            "created_at": datetime.now(timezone.utc),
            "expires_at": expires_at,
            "verified": False,
            "attempts": 0,
            "ip_address": ip_address
        })

        logger.info(f"Verification code created for {email}")
        return {
            "ok": True,
            "message": f"Verification code sent to {email}"
        }

    async def verify_code(self, email: str, code: str) -> dict:
        """Verify the code provided by user"""
        email = email.lower()

        # Find the code
        code_doc = await self.db.email_verification_codes.find_one({
            "email": email,
            "code": code,
            "verified": False
        })

        if not code_doc:
            return {"ok": False, "error": "Invalid verification code"}

        # Check expiry
        if datetime.now(timezone.utc) > code_doc["expires_at"]:
            return {"ok": False, "error": "Verification code expired"}

        # Check attempts
        if code_doc.get("attempts", 0) >= 3:
            return {"ok": False, "error": "Too many attempts. Request a new code."}

        # Mark as verified
        await self.db.email_verification_codes.update_one(
            {"_id": code_doc["_id"]},
            {"$set": {"verified": True}}
        )

        return {"ok": True, "email": email}

    async def cleanup_expired_codes(self):
        """Remove expired verification codes (call periodically)"""
        result = await self.db.email_verification_codes.delete_many({
            "expires_at": {"$lt": datetime.now(timezone.utc)}
        })
        logger.info(f"Cleaned up {result.deleted_count} expired codes")
```

### 1.4 New API Endpoints

**File:** `backend/server.py` - Add to `/api/auth` section

Replace the existing `/api/auth/session` endpoint with new endpoints:

```python
# ============== NEW AUTH ENDPOINTS (Email Code) ==============

class EmailLoginRequest(BaseModel):
    email: str = Field(..., min_length=3)

class VerifyCodeRequest(BaseModel):
    email: str
    code: str

@api_router.post("/auth/email/send-code")
async def send_verification_code(request: EmailLoginRequest, req: Request):
    """
    Step 1: Send verification code to email.
    Rate limited to 5 codes per hour per IP.
    """
    try:
        email = request.email.lower().strip()

        # Validate email format
        if '@' not in email or '.' not in email.split('@')[1]:
            raise HTTPException(status_code=400, detail="Invalid email format")

        # Get client IP (handle proxies)
        client_ip = req.client.host
        if x_forwarded_for := req.headers.get('X-Forwarded-For'):
            client_ip = x_forwarded_for.split(',')[0].strip()

        # Generate and send code
        auth_service = AuthService(db)
        result = await auth_service.send_verification_code(email, client_ip)

        if not result["ok"]:
            raise HTTPException(status_code=429, detail=result["error"])

        # Actually send the email
        from email_service import email_service
        code_doc = await db.email_verification_codes.find_one(
            {"email": email, "verified": False},
            sort=[("created_at", -1)]
        )

        if code_doc:
            email_sent = await email_service.send_verification_code(email, code_doc["code"])
            if not email_sent:
                # Clean up the code since email failed
                await db.email_verification_codes.delete_one({"_id": code_doc["_id"]})
                raise HTTPException(status_code=500, detail="Failed to send email")

        return {
            "ok": True,
            "message": f"Verification code sent to {email}"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending verification code: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@api_router.post("/auth/email/verify-code")
async def verify_email_code(request: VerifyCodeRequest, response: Response):
    """
    Step 2: Verify the code and create session.
    """
    try:
        email = request.email.lower().strip()
        code = request.code.strip()

        # Verify code
        auth_service = AuthService(db)
        verify_result = await auth_service.verify_code(email, code)

        if not verify_result["ok"]:
            raise HTTPException(status_code=400, detail=verify_result["error"])

        # Check if instance is locked to another user
        owner = await get_instance_owner()
        if owner and owner.get("email") != email:
            raise HTTPException(
                status_code=403,
                detail=f"This instance is locked to {owner.get('email')}. Access denied."
            )

        # Get or create user
        existing_user = await db.users.find_one({"email": email}, {"_id": 0})

        if existing_user:
            user_id = existing_user["user_id"]
            # Update last login
            await db.users.update_one(
                {"user_id": user_id},
                {"$set": {"last_login": datetime.now(timezone.utc)}}
            )
        else:
            # Create new user
            user_id = f"user_{uuid.uuid4().hex[:12]}"
            await db.users.insert_one({
                "user_id": user_id,
                "email": email,
                "name": email.split("@")[0],
                "picture": None,
                "created_at": datetime.now(timezone.utc),
                "last_login": datetime.now(timezone.utc)
            })

            # Lock instance to first user
            await set_instance_owner(User(
                user_id=user_id,
                email=email,
                name=email.split("@")[0],
                picture=None
            ))

        # Create session
        session_token = secrets.token_hex(32)
        expires_at = datetime.now(timezone.utc) + timedelta(days=SESSION_EXPIRY_DAYS)

        await db.user_sessions.insert_one({
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": expires_at,
            "created_at": datetime.now(timezone.utc)
        })

        # Set cookie
        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="lax",
            path="/",
            max_age=SESSION_EXPIRY_DAYS * 24 * 60 * 60
        )

        # Get user data
        user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})

        return {
            "ok": True,
            "user": user_doc
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error verifying code: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@api_router.post("/auth/email/resend-code")
async def resend_verification_code(request: EmailLoginRequest, req: Request):
    """Resend verification code (rate limited)"""
    try:
        email = request.email.lower().strip()
        client_ip = req.client.host

        # Delete old codes for this email
        await db.email_verification_codes.delete_many({
            "email": email,
            "verified": False
        })

        # Send new code
        auth_service = AuthService(db)
        result = await auth_service.send_verification_code(email, client_ip)

        if not result["ok"]:
            raise HTTPException(status_code=429, detail=result["error"])

        from email_service import email_service
        code_doc = await db.email_verification_codes.find_one(
            {"email": email, "verified": False},
            sort=[("created_at", -1)]
        )

        if code_doc:
            await email_service.send_verification_code(email, code_doc["code"])

        return {"ok": True, "message": "New code sent"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error resending code: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# Keep existing endpoints for backward compatibility temporarily
@api_router.get("/auth/instance")
async def get_instance_status():
    """Check if instance is locked"""
    owner = await get_instance_owner()
    return {"locked": bool(owner)}

@api_router.get("/auth/me")
async def get_me(request: Request):
    """Get current authenticated user"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user.model_dump()

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout"""
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})

    response.delete_cookie(key="session_token", path="/", secure=True, samesite="lax")
    return {"ok": True, "message": "Logged out"}
```

### 1.5 Database Indexes

Add to startup event in `server.py`:

```python
@app.on_event("startup")
async def setup_database():
    """Create indexes for performance"""
    # Existing indexes
    await db.users.create_index("user_id", unique=True)
    await db.users.create_index("email", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)

    # NEW: Email verification code indexes
    await db.email_verification_codes.create_index("email")
    await db.email_verification_codes.create_index([("expires_at", 1)], expireAfterSeconds=0)  # TTL
    await db.email_verification_codes.create_index("ip_address")

    logger.info("✅ Database indexes created")
```

### 1.6 Cleanup Job

Add periodic cleanup for expired codes. In `server.py`, add:

```python
import asyncio

async def cleanup_verification_codes():
    """Periodically clean up expired verification codes"""
    while True:
        try:
            await asyncio.sleep(3600)  # Run every hour
            auth_service = AuthService(db)
            await auth_service.cleanup_expired_codes()
        except Exception as e:
            logger.error(f"Cleanup error: {e}")

# Start cleanup task
@app.on_event("startup")
async def start_cleanup():
    asyncio.create_task(cleanup_verification_codes())
```

---

## Phase 2: Frontend Implementation

### 2.1 New Login Flow

Replace `LoginPage.js` with email code flow:

**File:** `frontend/src/pages/LoginPage.js`

```javascript
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, Mail, CheckCircle2, AlertCircle } from 'lucide-react';
import OpenMind from '@/components/ui/icons/OpenMind';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

const STEPS = {
  EMAIL: 'email',
  CODE: 'code',
  SUCCESS: 'success'
};

export default function LoginPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(STEPS.EMAIL);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [instanceLock, setInstanceLock] = useState(null);
  const [resendCountdown, setResendCountdown] = useState(0);

  useEffect(() => {
    checkAuth();
    checkInstanceLock();
  }, []);

  useEffect(() => {
    let timer;
    if (resendCountdown > 0) {
      timer = setInterval(() => setResendCountdown(c => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [resendCountdown]);

  const checkAuth = async () => {
    try {
      const response = await fetch(`${API}/auth/me`, { credentials: 'include' });
      if (response.ok) {
        navigate('/', { replace: true });
      }
    } catch (e) {
      // Not authenticated
    }
  };

  const checkInstanceLock = async () => {
    try {
      const response = await fetch(`${API}/auth/instance`);
      if (response.ok) {
        const data = await response.json();
        setInstanceLock(data);
      }
    } catch (e) {
      console.error('Error checking instance lock:', e);
    }
  };

  const handleSendCode = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        setError('Please enter a valid email address');
        setLoading(false);
        return;
      }

      const response = await fetch(`${API}/auth/email/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.detail || 'Failed to send code');
        setLoading(false);
        return;
      }

      setStep(STEPS.CODE);
      setResendCountdown(60);
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (code.length !== 6) {
        setError('Code must be 6 digits');
        setLoading(false);
        return;
      }

      const response = await fetch(`${API}/auth/email/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, code })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.detail || 'Invalid code');
        setLoading(false);
        return;
      }

      setStep(STEPS.SUCCESS);
      setTimeout(() => {
        navigate('/', { replace: true, state: { user: data.user } });
      }, 1500);
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API}/auth/email/resend-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.detail || 'Failed to resend code');
      } else {
        setResendCountdown(60);
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f10] text-zinc-100 flex items-center justify-center p-4">
      <div className="texture-noise" aria-hidden="true" />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        <Card className="border-[#1f2022] bg-[#141416]/95 backdrop-blur-sm">
          <CardHeader className="text-center space-y-4">
            <div className="flex items-center justify-center gap-3">
              <OpenMind size={48} />
            </div>
            <CardTitle className="heading text-2xl font-semibold">
              OpenMind Setup
            </CardTitle>
            <CardDescription className="text-zinc-400">
              {instanceLock?.locked
                ? 'This is a private instance. Only the owner can sign in.'
                : 'Sign in with your email to access OpenMind'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {step === STEPS.EMAIL && (
              <form onSubmit={handleSendCode} className="space-y-4">
                <div>
                  <label className="text-sm text-zinc-300 mb-2 block">
                    Email Address
                  </label>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    className="bg-[#1a1a1d] border-[#2a2a2f] text-white placeholder:text-zinc-500"
                  />
                </div>

                {error && (
                  <div className="rounded-lg bg-red-950/40 border border-red-900/60 p-3 flex gap-2 items-start">
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-red-300">{error}</span>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full bg-[#FF4500] hover:bg-[#FF4500]/90 text-white"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4 mr-2" />
                      Send Verification Code
                    </>
                  )}
                </Button>
              </form>
            )}

            {step === STEPS.CODE && (
              <form onSubmit={handleVerifyCode} className="space-y-4">
                <div>
                  <label className="text-sm text-zinc-300 mb-2 block">
                    Verification Code
                  </label>
                  <p className="text-xs text-zinc-500 mb-3">
                    Check your email at <span className="text-zinc-400 font-medium">{email}</span>
                  </p>
                  <Input
                    type="text"
                    placeholder="000000"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    disabled={loading}
                    maxLength="6"
                    className="bg-[#1a1a1d] border-[#2a2a2f] text-white placeholder:text-zinc-500 text-center text-2xl tracking-widest font-mono"
                  />
                </div>

                {error && (
                  <div className="rounded-lg bg-red-950/40 border border-red-900/60 p-3 flex gap-2 items-start">
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-red-300">{error}</span>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading || code.length !== 6}
                  className="w-full bg-[#FF4500] hover:bg-[#FF4500]/90 text-white"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'Verify Code'
                  )}
                </Button>

                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={resendCountdown > 0 || loading}
                  className="text-xs text-zinc-500 hover:text-zinc-400 underline underline-offset-2 w-full text-center disabled:text-zinc-600"
                >
                  {resendCountdown > 0
                    ? `Resend in ${resendCountdown}s`
                    : 'Didn\'t get the code? Resend'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStep(STEPS.EMAIL);
                    setCode('');
                    setError('');
                  }}
                  className="text-xs text-zinc-500 hover:text-zinc-400 underline underline-offset-2 w-full text-center"
                >
                  Use different email
                </button>
              </form>
            )}

            {step === STEPS.SUCCESS && (
              <div className="text-center space-y-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                >
                  <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
                </motion.div>
                <div>
                  <h3 className="font-semibold text-green-400 mb-2">Success!</h3>
                  <p className="text-sm text-zinc-400">Redirecting to OpenMind...</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-zinc-600 text-center mt-6">
          Powered by{' '}
          <a
            href="https://github.com/openclaw/openmind"
            target="_blank"
            rel="noreferrer"
            className="text-zinc-500 hover:text-zinc-400 underline underline-offset-2"
          >
            OpenMind
          </a>
        </p>
      </motion.div>
    </div>
  );
}
```

### 2.2 Remove AuthCallback

Delete `frontend/src/pages/AuthCallback.js` (no longer needed)

### 2.3 Update Router

**File:** `frontend/src/App.js` - Remove AuthCallback route:

```javascript
// Remove this route:
// <Route path="/auth/callback" element={<AuthCallback />} />

// Keep only:
<Route path="/login" element={<LoginPage />} />
```

---

## Phase 3: Security Hardening

### 3.1 Rate Limiting

Install `slowapi`:
```bash
pip install slowapi
```

Add to `server.py`:
```python
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

# Apply to auth endpoints
@api_router.post("/auth/email/send-code")
@limiter.limit("5/minute")
async def send_verification_code(...):
    ...

@api_router.post("/auth/email/verify-code")
@limiter.limit("10/minute")
async def verify_email_code(...):
    ...
```

### 3.2 CSRF Protection

Install `starlette-csrf`:
```bash
pip install starlette-csrf
```

Add to `server.py`:
```python
from starlette_csrf import CSRFMiddleware

app.add_middleware(
    CSRFMiddleware,
    secret_key=os.environ.get("CSRF_SECRET_KEY", secrets.token_hex(32))
)
```

### 3.3 Fix Cookie Security

Update `verify_email_code` to use secure cookies:
```python
response.set_cookie(
    key="session_token",
    value=session_token,
    httponly=True,      # ✅ No JavaScript access
    secure=True,        # ✅ HTTPS only
    samesite="lax",     # ✅ Prevent CSRF (changed from "none")
    path="/",
    max_age=SESSION_EXPIRY_DAYS * 24 * 60 * 60
)
```

---

## Phase 4: Migration Strategy

### Step 1: Run Both Systems in Parallel (Day 1)

1. Deploy email code endpoints
2. Keep Emergent OAuth working
3. Update LoginPage to show both options

```javascript
// Temporary: Show both options
<Tabs value={authMethod} onValueChange={setAuthMethod}>
  <TabsContent value="email">
    {/* Email code form */}
  </TabsContent>
  <TabsContent value="google">
    {/* Emergent OAuth button */}
  </TabsContent>
</Tabs>
```

### Step 2: Test Email Auth (Day 2)

- Send test emails
- Verify codes work
- Test rate limiting
- Verify session creation

### Step 3: Switch Default (Day 3)

- Update LoginPage to default to email
- Keep Emergent as fallback
- Test with staging users

### Step 4: Remove Emergent (Day 4)

- Remove all Emergent OAuth code
- Remove Emergent dependencies
- Final testing
- Deploy to production

### Step 5: Cleanup

- Delete old auth endpoints
- Remove unused imports
- Update documentation

---

## Testing Checklist

### Backend Tests
- [ ] Send code endpoint works
- [ ] Email actually sends
- [ ] Code expiry works (15 min)
- [ ] Rate limiting works (5/hour per IP)
- [ ] Code validation works
- [ ] Invalid codes rejected
- [ ] Expired codes rejected
- [ ] Session created on verification
- [ ] Instance locking works
- [ ] First user locks instance
- [ ] Other users get 403 error

### Frontend Tests
- [ ] Email input validates
- [ ] Code input accepts only digits
- [ ] Code length enforced (6 digits)
- [ ] Resend button appears after 60s
- [ ] Success animation shows
- [ ] Redirect works
- [ ] Mobile responsive
- [ ] Dark theme matches

### Integration Tests
- [ ] Full login flow works
- [ ] Session persists after refresh
- [ ] Logout works
- [ ] Protected pages redirect to login
- [ ] Error messages display correctly

### Security Tests
- [ ] Rate limiting blocks spam
- [ ] CSRF tokens work
- [ ] Cookies are httpOnly
- [ ] Cookies are secure flag
- [ ] No sensitive data in logs
- [ ] Expired codes cleaned up
- [ ] Invalid attempts tracked

---

## Rollback Plan

If email auth fails:

1. **Restore Emergent OAuth** (keep code in git)
2. **Revert LoginPage** to OAuth version
3. **Remove email auth routes** temporarily
4. **Keep MongoDB collections** (don't delete)

Estimated rollback time: **5 minutes**

---

## Timeline Estimate

| Phase | Task | Days | Notes |
|-------|------|------|-------|
| 0 | Setup SendGrid + env | 0.5 | Quick signup |
| 1 | Backend implementation | 1.5 | Services + endpoints |
| 2 | Frontend implementation | 1.5 | LoginPage component |
| 3 | Testing & fixes | 1 | Staging deployment |
| 4 | Migration & cleanup | 0.5 | Switch traffic |
| **Total** | | **5 days** | **1 week with buffer** |

---

## Success Criteria

✅ Users can login via email code
✅ No external OAuth dependency
✅ Session management works
✅ Instance locking works
✅ Rate limiting prevents abuse
✅ Emails deliver reliably
✅ Mobile-friendly UI
✅ Graceful error handling

---

## Questions for Approval

Before implementing, confirm:

1. **Email Provider:** Use SendGrid free tier? (Recommended)
2. **Code Length:** 6 digits? (Standard security)
3. **Code Expiry:** 15 minutes? (UX/security balance)
4. **Migration Timeline:** 1 week? (Parallel systems approach)
5. **Rollback Plan:** Keep Emergent code in git? (Safety)

---

## Next Steps

1. ✅ Get approval on this plan
2. 🔄 Set up SendGrid account
3. 🔄 Implement backend services
4. 🔄 Implement frontend flow
5. 🔄 Test thoroughly
6. 🔄 Deploy to staging
7. 🔄 Run migration
8. 🔄 Monitor and support

---

**Plan prepared by:** Claude AI
**Date:** 2026-02-23
**Status:** AWAITING APPROVAL
