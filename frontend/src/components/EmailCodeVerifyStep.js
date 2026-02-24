import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

export default function EmailCodeVerifyStep({ email, onSuccess, onBack }) {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [attemptsRemaining, setAttemptsRemaining] = useState(5);
  const inputRefs = useRef([]);

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Handle paste event for better UX
  const handlePaste = (e) => {
    const paste = (e.clipboardData || window.clipboardData).getData('text');
    // Extract only digits
    const digits = paste.replace(/\D/g, '').slice(0, 6);

    if (digits.length > 0) {
      const newCode = ['', '', '', '', '', ''];
      for (let i = 0; i < digits.length && i < 6; i++) {
        newCode[i] = digits[i];
      }
      setCode(newCode);
      setError(null);

      // Focus the appropriate input or submit if full
      const nextIndex = Math.min(digits.length, 5);
      if (digits.length === 6) {
        handleSubmit(newCode);
      } else {
        inputRefs.current[nextIndex]?.focus();
      }
    }
    e.preventDefault();
  };

  const handleInputChange = (index, value) => {
    // Only allow digits
    const digit = value.replace(/\D/g, '').slice(-1);

    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);
    setError(null);

    // Auto-focus next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit if all digits filled
    if (newCode.every((d) => d !== '')) {
      setTimeout(() => handleSubmit(newCode), 100);
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async (codeToVerify = null) => {
    const fullCode = (codeToVerify || code).join('');

    if (fullCode.length !== 6) {
      setError('Please enter all 6 digits');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API}/auth/email/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, code: fullCode })
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          setAttemptsRemaining(data.detail?.attempts_remaining || 0);
          setError(data.detail?.error || 'Invalid code. Please try again.');
        } else if (response.status === 400) {
          setError(data.detail?.error || 'Code expired. Please request a new code.');
        } else if (response.status === 403) {
          setError(data.detail?.error || 'Access denied.');
        } else {
          setError(data.error || 'Verification failed. Please try again.');
        }
        setLoading(false);
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
        return;
      }

      // Success!
      if (onSuccess) {
        onSuccess(data);
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error('Error verifying code:', err);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-300">
          Enter 6-Digit Code
        </label>
        <p className="text-xs text-zinc-500">
          Check your email at <strong>{email}</strong>
        </p>
      </div>

      <div className="flex justify-between gap-2">
        {code.map((digit, index) => (
          <input
            key={index}
            ref={(el) => (inputRefs.current[index] = el)}
            type="text"
            inputMode="numeric"
            pattern="[0-9]"
            maxLength="1"
            value={digit}
            onChange={(e) => handleInputChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            disabled={loading}
            className="w-12 h-12 text-center text-xl font-semibold bg-[#1f2022] border border-[#2f3032] rounded-lg text-zinc-100 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            autoComplete="off"
          />
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-red-900/60 bg-red-950/40 text-red-300 px-3 py-3 text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <div>{error}</div>
            {attemptsRemaining > 0 && attemptsRemaining < 5 && (
              <p className="text-xs text-red-400/70 mt-1">
                {attemptsRemaining} attempt{attemptsRemaining !== 1 ? 's' : ''} remaining
              </p>
            )}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <Button
          onClick={() => handleSubmit()}
          disabled={loading || code.some((d) => !d)}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11 font-medium"
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

        <Button
          onClick={onBack}
          disabled={loading}
          variant="outline"
          className="w-full"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Email
        </Button>
      </div>

      <p className="text-xs text-zinc-500 text-center">
        Code will expire in 10 minutes. You can request a new one after verifying fails.
      </p>
    </div>
  );
}
