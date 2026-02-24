# Email Authentication Implementation

This document describes the email code-based authentication system that replaces Emergent OAuth.

## Overview

The email authentication system provides a secure, passwordless login flow:

1. **User enters email** → Backend sends a 6-digit code to their email
2. **User receives code** → Code is valid for 10 minutes
3. **User enters code** → Backend verifies and creates a session
4. **User is logged in** → Same session management as before

## Architecture

### Backend Components

#### 1. `email_service.py` - Email Service Abstraction
Provides pluggable email providers with a common interface:

- **MailgunEmailService** (Recommended)
  - Uses Mailgun API for email delivery
  - Requires: `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`
  - Cost: $0.50/1000 emails (free tier: 100/day)

- **SendGridEmailService**
  - Uses SendGrid API for email delivery
  - Requires: `SENDGRID_API_KEY`
  - Cost: Free tier, 100/day

- **MockEmailService** (Development)
  - Stores codes in memory for testing
  - Perfect for local development and testing
  - No external dependencies

#### 2. `code_generator.py` - Code Management
Handles code generation, validation, and rate limiting:

- `generate_verification_code()` - Creates 6-digit random codes
- `request_code_rate_limit()` - Rate limit for email requests (3 per 15 minutes)
- `verify_code_rate_limit()` - Rate limit for code attempts (5 per code)
- `resend_code_rate_limit()` - Resend rate limit (2 per 5 minutes)
- `cleanup_expired_codes()` - Cleanup expired codes from database

#### 3. Backend Endpoints (in `server.py`)

**POST `/api/auth/email/request-code`**
- Request a verification code
- Rate limited: 3 requests per 15 minutes per email
- Returns: Code status and email confirmation
- Status codes: 200 (OK), 400 (validation error), 429 (rate limit)

**POST `/api/auth/email/verify-code`**
- Verify code and create session
- Rate limited: 5 attempts per code
- Returns: User data and session token
- Checks instance lock status
- Status codes: 200 (OK), 400 (expired), 401 (invalid), 403 (locked)

**POST `/api/auth/email/resend-code`**
- Resend verification code to email
- Rate limited: 2 resends per 5 minutes
- Same response as request-code

### Frontend Components

#### 1. `EmailRequestStep.js`
Email input and code request UI:
- Email validation
- Loading states
- Error display (invalid email, rate limit, etc.)
- Success message with masked email (u***@example.com)
- Resend button with countdown (30 seconds disabled)
- Countdown timer showing code expiry

#### 2. `EmailCodeVerifyStep.js`
6-digit code input and verification:
- 6 separate input fields with auto-focus
- Clipboard paste support (auto-parses code)
- Auto-submit on 6th digit
- Manual verify button
- Back to email link
- Attempts remaining counter
- Loading states

#### 3. `LoginPage.js`
Orchestrates the auth flow:
- Checks if already authenticated
- Checks instance lock status
- Switches between EmailRequestStep and EmailCodeVerifyStep
- Shows appropriate UI for locked/unlocked instances
- Navigates to dashboard after successful auth

## Setup Instructions

### 1. Environment Variables

Add to `.env`:

```bash
# Email Provider Configuration
EMAIL_PROVIDER=mailgun           # Options: mailgun, sendgrid, mock
MAILGUN_API_KEY=key_xxxxxxxxxxxx
MAILGUN_DOMAIN=mg.yourdomain.com
MAILGUN_FROM_EMAIL=noreply@yourdomain.com

# Code Settings
EMAIL_CODE_EXPIRY_MINUTES=10
EMAIL_CODE_LENGTH=6

# Rate Limiting
EMAIL_CODE_REQUEST_LIMIT=3       # per 15 minutes
EMAIL_CODE_REQUEST_WINDOW_MINUTES=15
EMAIL_CODE_VERIFY_ATTEMPTS=5     # per code
EMAIL_CODE_VERIFY_LOCKOUT_MINUTES=15
EMAIL_RESEND_LIMIT=2             # per 5 minutes
EMAIL_RESEND_WINDOW_MINUTES=5
```

### 2. Install Dependencies

```bash
pip install -r backend/requirements.txt
```

The `mailgun-python` package is now included for email delivery.

### 3. Database Indexes

Indexes are automatically created on server startup:
- TTL index on `expires_at` (auto-deletes expired codes)
- Compound index on `(email, verified)` for efficient queries

No manual migration needed - existing data is preserved.

### 4. Configure Email Provider

#### Using Mailgun (Recommended)

1. Sign up at https://www.mailgun.com/
2. Get your API key and domain
3. Set environment variables:
   ```bash
   EMAIL_PROVIDER=mailgun
   MAILGUN_API_KEY=key_xxxxxxxxxxxx
   MAILGUN_DOMAIN=mg.yourdomain.com
   ```

#### Using SendGrid

1. Sign up at https://sendgrid.com/
2. Get your API key
3. Set environment variables:
   ```bash
   EMAIL_PROVIDER=sendgrid
   SENDGRID_API_KEY=SG.xxxxxxxxxxxx
   SENDGRID_FROM_EMAIL=noreply@yourdomain.com
   ```

#### Using Mock (Development)

1. No setup needed - codes are stored in memory
2. Set environment variable:
   ```bash
   EMAIL_PROVIDER=mock
   ```
3. Retrieve codes from logs or via `get_last_code_for_email()` in tests

## Database Schema

### New Collection: `email_verification_codes`

```javascript
{
  _id: ObjectId,
  email: string,                    // lowercase normalized email
  code: string,                     // 6-digit code
  expires_at: datetime,             // TTL index (5-15 minutes)
  created_at: datetime,
  attempt_count: int,               // for rate limiting
  last_attempt_at: datetime,        // for rate limiting
  verified: boolean                 // flag to prevent reuse
}
```

**Indexes:**
- `email` (ascending) - for efficient lookups
- `expires_at` (ascending) - TTL index for auto-cleanup
- Compound: `{email: 1, verified: 0}` - for finding pending codes

### Modified Collection: `users`

New optional field:
- `email_verified_at: datetime` - timestamp of email verification

All existing fields preserved - fully backward compatible.

## API Response Examples

### Request Code Success (200)

```json
{
  "ok": true,
  "message": "Verification code sent to user@example.com",
  "expires_in_seconds": 600,
  "email_masked": "u***@example.com"
}
```

### Request Code - Rate Limit (429)

```json
{
  "ok": false,
  "error": "Too many code requests. Try again in 45 seconds",
  "retry_after": 45
}
```

### Verify Code Success (200)

```json
{
  "ok": true,
  "user": {
    "user_id": "user_abc123...",
    "email": "user@example.com",
    "name": "User Name",
    "picture": null,
    "created_at": "2026-02-23T12:00:00Z"
  },
  "session": {
    "token": "...",
    "expires_in_seconds": 604800
  }
}
```

### Verify Code - Invalid (401)

```json
{
  "ok": false,
  "error": "Invalid code",
  "attempts_remaining": 3
}
```

## Rate Limiting

### Email Request Rate Limit
- **Limit**: 3 requests per 15 minutes per email
- **Return**: 429 status with `retry_after` seconds
- **Implementation**: Database query counting recent codes

### Code Verification Rate Limit
- **Limit**: 5 attempts per code
- **Return**: 401 status after failure
- **Lockout**: No automatic unlock - user must request new code
- **Implementation**: `attempt_count` field in code document

### Resend Rate Limit
- **Limit**: 2 resends per 5 minutes per email
- **Return**: 429 status with `retry_after` seconds
- **Stricter** than initial request to encourage code saving

## Security Considerations

### Code Security
- **6-digit codes**: 1 million combinations
- **Randomness**: Uses Python's `secrets` module
- **Expiry**: 10 minutes (configurable)
- **Format**: Numeric only (easier for users)
- **TTL Index**: Automatic database cleanup

### Timing Attacks
- Code comparison uses standard `==` operator (acceptable for 6-digit codes)
- Email existence not revealed on request-code endpoint
- Instance lock only revealed on successful code verification

### Session Security
- **Token Format**: 64 hex characters (256-bit entropy)
- **Cookie Settings**:
  - `httpOnly=True` - not accessible to JavaScript
  - `secure=True` - HTTPS only in production
  - `samesite="none"` - allows cross-origin requests
- **Expiry**: 7 days (same as before)

### Email Validation
- Uses `email-validator` library for format validation
- Normalizes to lowercase for consistency
- Case-insensitive lookups in database

## Testing

### Run Tests

```bash
cd /home/user/OpenMindForkYou/backend

# Using pytest
pytest test_email_auth.py -v

# With coverage
pytest test_email_auth.py --cov=code_generator --cov=email_service
```

### Test Coverage

- Code generation (randomness, format)
- Rate limiting (all three types)
- Email service implementations
- Code cleanup
- Database operations

### Manual Testing

1. **Local Development** (with mock service):
   ```bash
   EMAIL_PROVIDER=mock python -m uvicorn backend.server:app
   ```

2. **Check sent codes** in backend logs or via mock service

3. **Test rate limiting**:
   - Request code 3 times → 4th blocked with 429
   - Verify code 5 times incorrectly → 6th blocked
   - Resend code 2 times → 3rd blocked

## Migration Guide

### From Emergent OAuth

1. **No Data Migration**: New collection doesn't affect existing data
2. **Session Compatibility**: New system uses same session format
3. **Backward Compatible**: Old sessions continue to work

### Deployment Steps

1. Deploy backend (both systems run in parallel)
2. Deploy frontend (switches to email flow)
3. Monitor for errors (24 hours)
4. Keep rollback plan ready (revert commits, keep old session data)

### Rollback Procedure

If critical issues occur:

1. Revert frontend to previous version (still has fallback support)
2. Keep backend email endpoints (they don't break anything)
3. Users with new sessions will continue working
4. New users will need code requests redone

## Troubleshooting

### Email Not Received

1. Check spam/junk folder
2. Verify email address is correct
3. Check backend logs for email service errors
4. Verify email provider credentials (MAILGUN_API_KEY, etc.)
5. Use resend button (up to 2 times per 5 minutes)

### Code Expired

1. User takes longer than 10 minutes - request new code
2. UI shows countdown timer - monitor for expiry
3. New code can be requested immediately (different from resend)

### Instance Locked Error

1. Instance is locked to owner's email
2. Only owner can log in
3. Show appropriate UI message (handled in LoginPage)

### Rate Limit Errors

1. "Too many requests" - wait before retrying
2. UI shows `retry_after` seconds
3. Can try again after countdown

## Performance

### Database Queries

- Request code: 1 count query (all recent codes) + 1 insert
- Verify code: 1 find query + potential updates
- Resend code: 1 find query (all codes) + 1 insert

### Email Delivery

- Mailgun: <1 second typically
- SendGrid: <1 second typically
- Mock: Instant (memory)

### TTL Index Cleanup

- MongoDB automatically deletes expired codes after `expireAfterSeconds`
- No manual cleanup needed
- Can manually call `cleanup_expired_codes()` if needed

## Monitoring

### Key Metrics

Track these in your monitoring system:

```
- Email code requests/minute
- Verification success rate (%)
- Verification failure rate (%)
- Rate limit hits (429 responses)
- Email delivery success rate (%)
- Email delivery latency (ms)
- Session creation success rate (%)
```

### Logging

All authentication events are logged:
- Code requested: `code_requested` event
- Code verified: `code_verified` event
- Code failed: `code_failed` event
- Rate limits: `rate_limit_hit` event
- Email sent: `email_sent` event

## Configuration Reference

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `EMAIL_PROVIDER` | Which provider to use | mock | No |
| `MAILGUN_API_KEY` | Mailgun API key | - | Yes (if using Mailgun) |
| `MAILGUN_DOMAIN` | Mailgun domain | - | Yes (if using Mailgun) |
| `MAILGUN_FROM_EMAIL` | Sender email | noreply@{domain} | No |
| `SENDGRID_API_KEY` | SendGrid API key | - | Yes (if using SendGrid) |
| `SENDGRID_FROM_EMAIL` | Sender email | noreply@openmind.ai | No |
| `EMAIL_CODE_EXPIRY_MINUTES` | Code valid for (min) | 10 | No |
| `EMAIL_CODE_REQUEST_LIMIT` | Max requests per window | 3 | No |
| `EMAIL_CODE_REQUEST_WINDOW_MINUTES` | Request rate limit window | 15 | No |
| `EMAIL_CODE_VERIFY_ATTEMPTS` | Max verify attempts | 5 | No |
| `EMAIL_RESEND_LIMIT` | Max resends per window | 2 | No |
| `EMAIL_RESEND_WINDOW_MINUTES` | Resend rate limit window | 5 | No |

## Support & Debugging

### Common Issues

1. **"MAILGUN_API_KEY and MAILGUN_DOMAIN must be set"**
   - Add missing environment variables to `.env`
   - Restart backend server

2. **Email service initialization fails**
   - Check EMAIL_PROVIDER value (must be: mailgun, sendgrid, or mock)
   - Verify credentials for chosen provider

3. **Codes not appearing in database**
   - Check that indexes were created (check MongoDB)
   - Verify email validation passed
   - Check backend logs for errors

4. **Frontend can't reach backend**
   - Verify REACT_APP_BACKEND_URL is set correctly
   - Check CORS configuration
   - Verify backend is running

## Future Enhancements

Potential improvements:

1. **SMS Fallback** - Send code via SMS if email fails
2. **Account Recovery** - Help users recover accounts
3. **2FA** - Add optional two-factor authentication
4. **Device Trust** - Remember trusted devices
5. **Biometric Auth** - Add fingerprint/face auth on mobile
6. **Passwordless Accounts** - Optional password setup

## References

- Mailgun API: https://documentation.mailgun.com/
- SendGrid API: https://docs.sendgrid.com/
- MongoDB TTL: https://docs.mongodb.com/manual/core/index-ttl/
- OWASP Auth: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
