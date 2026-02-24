import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Loader2, Lock } from 'lucide-react';
import OpenMind from '@/components/ui/icons/OpenMind';
import EmailRequestStep from '@/components/EmailRequestStep';
import EmailCodeVerifyStep from '@/components/EmailCodeVerifyStep';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

export default function LoginPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [instanceLock, setInstanceLock] = useState(null);
  const [authStep, setAuthStep] = useState('email'); // 'email' or 'verify'
  const [emailForVerify, setEmailForVerify] = useState('');

  // Check if already authenticated and instance lock status
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check instance lock status first
        const instanceRes = await fetch(`${API}/auth/instance`);
        if (instanceRes.ok) {
          const instanceData = await instanceRes.json();
          setInstanceLock(instanceData);
        }

        const response = await fetch(`${API}/auth/me`, {
          credentials: 'include'
        });
        if (response.ok) {
          // Already authenticated, go to setup
          navigate('/', { replace: true });
          return;
        }
      } catch (e) {
        // Not authenticated
      }
      setChecking(false);
    };
    checkAuth();
  }, [navigate]);

  const handleCodeSent = (email) => {
    setEmailForVerify(email);
    setAuthStep('verify');
  };

  const handleVerifySuccess = (data) => {
    // Email auth successful, navigate to home
    window.history.replaceState(null, '', window.location.pathname);
    navigate('/', { replace: true, state: { user: data.user } });
  };

  const handleBackToEmail = () => {
    setAuthStep('email');
    setEmailForVerify('');
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-[#0f0f10] flex items-center justify-center">
        <div className="text-zinc-400 flex items-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          Checking authentication...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f10] text-zinc-100 flex items-center justify-center p-4">
      {/* Subtle texture overlay */}
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
                : 'Sign in with your email to configure and access your personal OpenMind instance.'
              }
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {instanceLock?.locked ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-red-900/60 bg-red-950/40 text-red-300 px-4 py-4 text-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <Lock className="w-4 h-4" />
                    <span className="font-medium">Private Instance</span>
                  </div>
                  <p className="text-red-400/80">
                    This OpenMind instance is private and access is restricted.
                  </p>
                </div>
                <p className="text-xs text-zinc-600 text-center">
                  Sign in with the registered email to access this instance.
                </p>
                {authStep === 'email' && (
                  <EmailRequestStep
                    onCodeSent={handleCodeSent}
                    isLocked={true}
                  />
                )}
                {authStep === 'verify' && (
                  <EmailCodeVerifyStep
                    email={emailForVerify}
                    onSuccess={handleVerifySuccess}
                    onBack={handleBackToEmail}
                  />
                )}
              </div>
            ) : (
              <>
                {authStep === 'email' && (
                  <EmailRequestStep
                    onCodeSent={handleCodeSent}
                    isLocked={false}
                  />
                )}
                {authStep === 'verify' && (
                  <EmailCodeVerifyStep
                    email={emailForVerify}
                    onSuccess={handleVerifySuccess}
                    onBack={handleBackToEmail}
                  />
                )}
              </>
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
