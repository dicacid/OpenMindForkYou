import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
  Sparkles,
  Shield,
  Unlock,
  MessageCircle,
  Zap,
  Brain
} from 'lucide-react';
import OpenClaw from '@/components/ui/icons/OpenClaw';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

const AI_PROVIDERS = [
  {
    id: 'openai',
    name: 'OpenAI',
    icon: '🤖',
    description: 'GPT-4 and GPT-5 models',
    needsKey: true
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    icon: '🧠',
    description: 'Claude 3.5 Sonnet and Opus',
    needsKey: true
  },
  {
    id: 'ollama',
    name: 'Ollama',
    icon: '🦙',
    description: 'Run models locally',
    needsKey: false,
    info: 'Connects to localhost:11434'
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    icon: '🔀',
    description: 'Access multiple providers',
    needsKey: true
  }
];

const MESSAGING_APPS = [
  { id: 'whatsapp', name: 'WhatsApp', icon: '💬', color: 'bg-green-500' },
  { id: 'telegram', name: 'Telegram', icon: '✈️', color: 'bg-blue-500' },
  { id: 'discord', name: 'Discord', icon: '🎮', color: 'bg-indigo-500' },
  { id: 'slack', name: 'Slack', icon: '💼', color: 'bg-purple-500' }
];

function WelcomeStep({ onNext }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="text-center space-y-8"
    >
      <div className="flex justify-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', duration: 0.8 }}
        >
          <OpenClaw size={120} />
        </motion.div>
      </div>
      
      <div className="space-y-4">
        <h1 className="heading text-4xl font-bold text-zinc-100">
          Welcome to OpenMind
        </h1>
        <p className="text-2xl text-[#FF4500] font-medium">
          Your AI That Actually Does Things
        </p>
        <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
          OpenMind is your personal AI assistant with real capabilities. It can execute tasks, 
          interact with your tools, and help you get things done across your entire workflow.
        </p>
      </div>

      <Button
        onClick={onNext}
        size="lg"
        className="bg-[#FF4500] hover:bg-[#E63E00] text-lg px-8 py-6"
      >
        Let's Get Started
        <ArrowRight className="w-5 h-5 ml-2" />
      </Button>
    </motion.div>
  );
}

function NameStep({ data, onChange, onNext, onPrev }) {
  const [assistantName, setAssistantName] = useState(data.assistantName || 'Mind');
  const [userName, setUserName] = useState(data.userName || '');

  const handleNext = () => {
    if (!userName.trim()) {
      toast.error('Please enter your name');
      return;
    }
    onChange({ assistantName, userName });
    onNext();
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="text-center space-y-2">
        <h2 className="heading text-3xl font-bold text-zinc-100">
          Let's Get Acquainted
        </h2>
        <p className="text-zinc-400">
          Personalize your assistant so it knows who's talking
        </p>
      </div>

      <Card className="border-[#1f2022] bg-[#141416]/95">
        <CardContent className="pt-6 space-y-6">
          <div className="space-y-3">
            <Label className="text-zinc-300 text-lg">What would you like to call your assistant?</Label>
            <Input
              value={assistantName}
              onChange={(e) => setAssistantName(e.target.value)}
              placeholder="e.g., Mind, Alfred, Jarvis"
              className="bg-[#0f0f10] border-[#1f2022] text-zinc-100 text-lg h-12"
            />
            <p className="text-sm text-zinc-500">You can change this later</p>
          </div>

          <div className="space-y-3">
            <Label className="text-zinc-300 text-lg">What's your name?</Label>
            <Input
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Your name"
              className="bg-[#0f0f10] border-[#1f2022] text-zinc-100 text-lg h-12"
            />
            <p className="text-sm text-zinc-500">So your assistant knows who it's talking to</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onPrev} className="border-[#1f2022]">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button onClick={handleNext} className="bg-[#FF4500] hover:bg-[#E63E00]">
          Continue
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </motion.div>
  );
}

function ProviderStep({ data, onChange, onNext, onPrev }) {
  const [selectedProvider, setSelectedProvider] = useState(data.provider || 'openai');
  const [apiKey, setApiKey] = useState(data.apiKey || '');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const provider = AI_PROVIDERS.find(p => p.id === selectedProvider);

  const handleTest = async () => {
    if (provider.needsKey && !apiKey.trim()) {
      toast.error('Please enter an API key');
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch(`${API}/onboarding/test-provider`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ provider: selectedProvider, api_key: apiKey })
      });
      
      if (res.ok) {
        setTestResult('success');
        toast.success('Connection successful!');
      } else {
        setTestResult('failed');
        toast.error('Connection failed');
      }
    } catch (e) {
      setTestResult('failed');
      toast.error('Connection failed');
    } finally {
      setTesting(false);
    }
  };

  const handleNext = () => {
    if (provider.needsKey && !apiKey.trim()) {
      toast.error('Please enter an API key or test the connection');
      return;
    }
    onChange({ provider: selectedProvider, apiKey });
    onNext();
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="text-center space-y-2">
        <h2 className="heading text-3xl font-bold text-zinc-100">
          Choose Your AI Provider
        </h2>
        <p className="text-zinc-400">
          Select which AI model you'd like to use
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {AI_PROVIDERS.map((p) => (
          <Card
            key={p.id}
            className={`cursor-pointer transition-all border-2 ${
              selectedProvider === p.id
                ? 'border-[#FF4500] bg-[#FF4500]/5'
                : 'border-[#1f2022] hover:border-[#2f3032]'
            }`}
            onClick={() => setSelectedProvider(p.id)}
          >
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="text-4xl">{p.icon}</div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-zinc-100">{p.name}</h3>
                  <p className="text-sm text-zinc-400 mt-1">{p.description}</p>
                </div>
                {selectedProvider === p.id && (
                  <div className="w-6 h-6 rounded-full bg-[#FF4500] flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {provider.needsKey ? (
        <Card className="border-[#1f2022] bg-[#141416]/95">
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-zinc-300">API Key</Label>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={`Enter your ${provider.name} API key`}
                className="bg-[#0f0f10] border-[#1f2022] text-zinc-100 font-mono"
              />
            </div>
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={testing}
              className="w-full border-[#1f2022]"
            >
              {testing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : testResult === 'success' ? (
                <Check className="w-4 h-4 mr-2 text-green-500" />
              ) : null}
              {testing ? 'Testing...' : 'Test Connection'}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-blue-500/20 bg-blue-950/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="text-blue-400">ℹ️</div>
              <div>
                <p className="text-sm text-blue-300">
                  {provider.info}
                </p>
                <p className="text-xs text-blue-400 mt-2">
                  Make sure Ollama is running on your machine
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onPrev} className="border-[#1f2022]">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button onClick={handleNext} className="bg-[#FF4500] hover:bg-[#E63E00]">
          Continue
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </motion.div>
  );
}

function AccessModeStep({ data, onChange, onNext, onPrev }) {
  const [selectedMode, setSelectedMode] = useState(data.accessMode || 'sandbox');

  const handleNext = () => {
    onChange({ accessMode: selectedMode });
    onNext();
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="text-center space-y-2">
        <h2 className="heading text-3xl font-bold text-zinc-100">
          Choose Access Mode
        </h2>
        <p className="text-zinc-400">
          Control how much access your assistant has
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card
          className={`cursor-pointer transition-all border-2 ${
            selectedMode === 'sandbox'
              ? 'border-[#FF4500] bg-[#FF4500]/5'
              : 'border-[#1f2022] hover:border-[#2f3032]'
          }`}
          onClick={() => setSelectedMode('sandbox')}
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <Shield className="w-8 h-8 text-green-500" />
              {selectedMode === 'sandbox' && (
                <div className="w-6 h-6 rounded-full bg-[#FF4500] flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
            <CardTitle className="text-zinc-100">Sandbox Mode</CardTitle>
            <CardDescription className="text-zinc-400">
              Safe. Restricted to a dedicated folder.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-zinc-400">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span>Limited file access</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span>Can't modify system files</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span>Recommended for most users</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all border-2 ${
            selectedMode === 'host'
              ? 'border-[#FF4500] bg-[#FF4500]/5'
              : 'border-[#1f2022] hover:border-[#2f3032]'
          }`}
          onClick={() => setSelectedMode('host')}
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <Unlock className="w-8 h-8 text-orange-500" />
              {selectedMode === 'host' && (
                <div className="w-6 h-6 rounded-full bg-[#FF4500] flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
            <CardTitle className="text-zinc-100">Host Mode</CardTitle>
            <CardDescription className="text-zinc-400">
              Full system access. For power users.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-zinc-400">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-orange-500" />
                <span>Full file system access</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-orange-500" />
                <span>Can control your computer</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-orange-500" />
                <span>Maximum capabilities</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onPrev} className="border-[#1f2022]">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button onClick={handleNext} className="bg-[#FF4500] hover:bg-[#E63E00]">
          Continue
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </motion.div>
  );
}

function MessagingStep({ data, onChange, onNext, onPrev }) {
  const [connected, setConnected] = useState(data.messaging || []);

  const handleConnect = (appId) => {
    if (connected.includes(appId)) {
      setConnected(connected.filter(id => id !== appId));
    } else {
      setConnected([...connected, appId]);
      toast.success(`${MESSAGING_APPS.find(a => a.id === appId).name} connected!`);
    }
  };

  const handleNext = () => {
    onChange({ messaging: connected });
    onNext();
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="text-center space-y-2">
        <h2 className="heading text-3xl font-bold text-zinc-100">
          Connect a Messaging App
        </h2>
        <p className="text-zinc-400">
          Get notifications and interact with your assistant (optional)
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {MESSAGING_APPS.map((app) => (
          <Card
            key={app.id}
            className={`border-2 transition-all ${
              connected.includes(app.id)
                ? 'border-[#FF4500] bg-[#FF4500]/5'
                : 'border-[#1f2022]'
            }`}
          >
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="text-5xl">{app.icon}</div>
                <h3 className="text-lg font-semibold text-zinc-100">{app.name}</h3>
                <Button
                  variant={connected.includes(app.id) ? 'default' : 'outline'}
                  className={connected.includes(app.id) ? 'bg-[#FF4500] hover:bg-[#E63E00]' : 'border-[#1f2022]'}
                  onClick={() => handleConnect(app.id)}
                >
                  {connected.includes(app.id) ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Connected
                    </>
                  ) : (
                    'Connect'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onPrev} className="border-[#1f2022]">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleNext} className="border-[#1f2022]">
            Skip
          </Button>
          <Button onClick={handleNext} className="bg-[#FF4500] hover:bg-[#E63E00]">
            Continue
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

function SummaryStep({ data, onComplete }) {
  const [launching, setLaunching] = useState(false);

  const handleLaunch = async () => {
    setLaunching(true);
    
    try {
      // Save configuration to backend
      await fetch(`${API}/onboarding/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      });
      
      // Mark wizard as complete in localStorage
      localStorage.setItem('openmind_onboarding_complete', 'true');
      
      toast.success('Configuration saved!');
      setTimeout(() => {
        onComplete();
      }, 1000);
    } catch (e) {
      console.error('Failed to save configuration:', e);
      toast.error('Failed to save configuration');
      setLaunching(false);
    }
  };

  const provider = AI_PROVIDERS.find(p => p.id === data.provider);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="text-center space-y-8"
    >
      <div className="space-y-4">
        <div className="w-20 h-20 rounded-full bg-green-500/10 border-2 border-green-500 flex items-center justify-center mx-auto">
          <Check className="w-10 h-10 text-green-500" />
        </div>
        <h2 className="heading text-3xl font-bold text-zinc-100">
          All Done!
        </h2>
        <p className="text-zinc-400 text-lg">
          Your assistant is ready to go
        </p>
      </div>

      <Card className="border-[#1f2022] bg-[#141416]/95 text-left">
        <CardHeader>
          <CardTitle className="text-zinc-100">Configuration Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-[#1f2022]">
            <span className="text-zinc-400">Assistant Name</span>
            <span className="text-zinc-100 font-medium">{data.assistantName}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-[#1f2022]">
            <span className="text-zinc-400">Your Name</span>
            <span className="text-zinc-100 font-medium">{data.userName}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-[#1f2022]">
            <span className="text-zinc-400">AI Provider</span>
            <span className="text-zinc-100 font-medium flex items-center gap-2">
              <span>{provider?.icon}</span>
              {provider?.name}
            </span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-[#1f2022]">
            <span className="text-zinc-400">Access Mode</span>
            <span className="text-zinc-100 font-medium capitalize">{data.accessMode}</span>
          </div>
          {data.messaging && data.messaging.length > 0 && (
            <div className="flex items-center justify-between py-2">
              <span className="text-zinc-400">Connected Apps</span>
              <div className="flex gap-1">
                {data.messaging.map(appId => {
                  const app = MESSAGING_APPS.find(a => a.id === appId);
                  return <span key={appId} className="text-xl">{app?.icon}</span>;
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Button
        onClick={handleLaunch}
        disabled={launching}
        size="lg"
        className="bg-[#FF4500] hover:bg-[#E63E00] text-lg px-8 py-6"
      >
        {launching ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Launching...
          </>
        ) : (
          <>
            <Sparkles className="w-5 h-5 mr-2" />
            Launch OpenMind
          </>
        )}
      </Button>
    </motion.div>
  );
}

export default function OnboardingWizard({ onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [wizardData, setWizardData] = useState({
    assistantName: 'Mind',
    userName: '',
    provider: 'openai',
    apiKey: '',
    accessMode: 'sandbox',
    messaging: []
  });

  const steps = [
    { component: WelcomeStep, title: 'Welcome' },
    { component: NameStep, title: 'Name' },
    { component: ProviderStep, title: 'Provider' },
    { component: AccessModeStep, title: 'Access' },
    { component: MessagingStep, title: 'Messaging' },
    { component: SummaryStep, title: 'Complete' }
  ];

  const CurrentStepComponent = steps[currentStep].component;
  const progress = ((currentStep + 1) / steps.length) * 100;

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleDataChange = (newData) => {
    setWizardData({ ...wizardData, ...newData });
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0f0f10] flex items-center justify-center p-4">
      <div className="texture-noise" aria-hidden="true" />
      
      <div className="w-full max-w-4xl relative z-10">
        {/* Progress Bar */}
        {currentStep > 0 && currentStep < steps.length - 1 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-zinc-400">Step {currentStep + 1} of {steps.length}</span>
              <span className="text-sm text-zinc-400">{steps[currentStep].title}</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Step Content */}
        <AnimatePresence mode="wait">
          <CurrentStepComponent
            key={currentStep}
            data={wizardData}
            onChange={handleDataChange}
            onNext={handleNext}
            onPrev={handlePrev}
            onComplete={onComplete}
          />
        </AnimatePresence>
      </div>
    </div>
  );
}
