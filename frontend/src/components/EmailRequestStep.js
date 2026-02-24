import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

export default function EmailRequestStep({ onCodeSent, isLocked }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [codeSent, setCodeSent] = useState(false);
  const [expiresIn, setExpiresIn] = useState(null);
  const [emailMasked, setEmailMasked] = useState(null);
  const [resendDisabled, setResendDisabled] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  // Countdown timer for expires_in
  useEffect(() => {
    let interval;
    if (codeSent && expiresIn && expiresIn > 0) {
      interval = setInterval(() => {
        setExpiresIn((prev) => {
          const next = prev - 1;
          if (next <= 0) {
            setCodeSent(false);
          }
          return next;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [codeSent, expiresIn]);

  // Countdown for resend button
  useEffect(() => {
    let interval;
    if (resendCountdown > 0) {
      interval = setInterval(() => {
        setResendCountdown((prev) => {
          if (prev <= 1) {
            setResendDisabled(false);
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendCountdown]);

  const validateEmail = (value) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validate email
    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }

    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API}/auth/email/request-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.toLowerCase() })
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          setError(
            data.error || 'Too many requests. Please try again later.'
          );
        } else {
          setError(data.error || 'Failed to send code. Please try again.');
        }
        setLoading(false);
        return;
      }

      // Success
      setCodeSent(true);
      setExpiresIn(data.expires_in_seconds);
      setEmailMasked(data.email_masked);
      setResendDisabled(true);
      setResendCountdown(30); // Disable resend for 30 seconds

      // Notify parent component
      if (onCodeSent) {
        onCodeSent(email);
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error('Error requesting code:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(`${API}/auth/email/resend-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.toLowerCase() })
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          setError(data.error || 'Too many resend requests. Please wait.');
        } else {
          setError(data.error || 'Failed to resend code.');
        }
        setLoading(false);
        return;
      }

      // Reset countdown
      setExpiresIn(data.expires_in_seconds);
      setResendDisabled(true);
      setResendCountdown(30);
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error('Error resending code:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestNewCode = () => {
    setCodeSent(false);
    setExpiresIn(null);
    setEmailMasked(null);
    setEmail('');
    setError(null);
  };

  if (codeSent) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-green-900/60 bg-green-950/40 text-green-300 px-4 py-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4" />
            <span className="font-medium">Code sent!</span>
          </div>
          <p className="text-sm text-green-400/80 mb-2">
            Check your email at <strong>{emailMasked}</strong> for a 6-digit verification code.
          </p>
          {expiresIn && (
            <p className="text-xs text-green-400/60">
              Code expires in {Math.floor(expiresIn / 60)}:{String(expiresIn % 60).padStart(2, '0')}
            </p>
          )}
        </div>

        <div className="space-y-3">
          <p className="text-sm text-zinc-400 text-center">
            Enter the code on the next screen
          </p>

          <div className="flex gap-2">
            <Button
              onClick={handleResend}
              disabled={resendDisabled || loading}
              variant="outline"
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Resending...
                </>
              ) : (
                <>
                  {resendDisabled && resendCountdown > 0
                    ? `Resend (${resendCountdown}s)`
                    : 'Resend Code'}
                </>
              )}
            </Button>

            <Button
              onClick={handleRequestNewCode}
              variant="outline"
              className="flex-1"
              disabled={loading}
            >
              Use Different Email
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium text-zinc-300">
          Email Address
        </label>
        <input
          id="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError(null);
          }}
          disabled={loading || isLocked}
          className="w-full px-3 py-2 bg-[#1f2022] border border-[#2f3032] rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          autoComplete="email"
          autoFocus
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-900/60 bg-red-950/40 text-red-300 px-3 py-2 text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isLocked && (
        <div className="rounded-lg border border-amber-900/60 bg-amber-950/40 text-amber-300 px-3 py-2 text-sm">
          This instance is locked. Only the owner can sign in.
        </div>
      )}

      <Button
        type="submit"
        disabled={loading || !email.trim() || isLocked}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11 font-medium"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Sending code...
          </>
        ) : (
          'Send Login Code'
        )}
      </Button>

      <p className="text-xs text-zinc-500 text-center">
        We'll send a 6-digit code to your email. No password needed!
      </p>
    </form>
  );
}
