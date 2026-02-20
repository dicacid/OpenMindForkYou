import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Send,
  Loader2,
  User,
  Bot,
  ChevronRight,
  ChevronLeft,
  Code2
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

function ToolCallPanel({ calls, expanded }) {
  if (!expanded) return null;

  return (
    <div className="w-80 border-l border-[#1f2022] bg-[#0f0f10] flex flex-col">
      <div className="p-4 border-b border-[#1f2022]">
        <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
          <Code2 className="w-4 h-4" />
          Tool Calls
        </h3>
      </div>
      <ScrollArea className="flex-1 p-4">
        {calls.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-8">
            No tool calls in this session
          </p>
        ) : (
          <div className="space-y-3">
            {calls.map((call, idx) => (
              <Card key={idx} className="border-[#1f2022] bg-[#141416]/50">
                <CardContent className="p-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge className="bg-[#8B5CF6]/10 text-[#8B5CF6] border-[#8B5CF6]/20">
                        {call.tool_name}
                      </Badge>
                      <span className="text-xs text-zinc-500">
                        {new Date(call.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <details className="text-xs">
                      <summary className="cursor-pointer text-zinc-400 hover:text-zinc-300">
                        Arguments
                      </summary>
                      <pre className="mt-2 p-2 rounded bg-[#0f0f10] text-zinc-500 overflow-x-auto">
                        {JSON.stringify(call.arguments, null, 2)}
                      </pre>
                    </details>
                    <details className="text-xs">
                      <summary className="cursor-pointer text-zinc-400 hover:text-zinc-300">
                        Result
                      </summary>
                      <pre className="mt-2 p-2 rounded bg-[#0f0f10] text-zinc-500 overflow-x-auto">
                        {JSON.stringify(call.result, null, 2).substring(0, 200)}...
                      </pre>
                    </details>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

export default function ChatPage() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [toolCalls, setToolCalls] = useState([]);
  const [showToolPanel, setShowToolPanel] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = { role: 'user', content: input };
    setMessages([...messages, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(`${API}/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: input, session_id: 'current' })
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
        if (data.tool_calls) {
          setToolCalls(prev => [...prev, ...data.tool_calls]);
        }
      } else {
        throw new Error('Failed to send message');
      }
    } catch (e) {
      console.error('Failed to send message:', e);
      toast.error('Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f10] text-zinc-100 flex flex-col">
      <div className="texture-noise" aria-hidden="true" />

      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#141416]/95 backdrop-blur-sm border-b border-[#1f2022]">
        <div className="container mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/')}
                className="text-zinc-400 hover:text-zinc-200"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div className="h-6 w-px bg-[#1f2022]" />
              <h1 className="heading text-xl font-semibold flex items-center gap-2">
                <Bot className="w-5 h-5 text-[#8B5CF6]" />
                Chat with Mind
              </h1>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowToolPanel(!showToolPanel)}
              className="text-zinc-400 hover:text-zinc-200"
            >
              {showToolPanel ? (
                <ChevronRight className="w-4 h-4 mr-2" />
              ) : (
                <ChevronLeft className="w-4 h-4 mr-2" />
              )}
              {showToolPanel ? 'Hide' : 'Show'} Tools
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          <ScrollArea className="flex-1 px-4 py-6">
            <div className="max-w-4xl mx-auto space-y-4">
              {messages.length === 0 && (
                <div className="text-center py-12 text-zinc-500">
                  <Bot className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>Start a conversation with your assistant</p>
                </div>
              )}

              {messages.map((msg, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-[#8B5CF6]/10 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-5 h-5 text-[#8B5CF6]" />
                    </div>
                  )}
                  <div
                    className={`max-w-2xl px-4 py-3 rounded-lg ${
                      msg.role === 'user'
                        ? 'bg-[#8B5CF6] text-white'
                        : 'bg-[#141416] text-zinc-100 border border-[#1f2022]'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-zinc-300" />
                    </div>
                  )}
                </motion.div>
              ))}

              {loading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-3"
                >
                  <div className="w-8 h-8 rounded-full bg-[#8B5CF6]/10 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-[#8B5CF6]" />
                  </div>
                  <div className="px-4 py-3 rounded-lg bg-[#141416] border border-[#1f2022]">
                    <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input Area */}
          <div className="border-t border-[#1f2022] p-4 bg-[#141416]">
            <div className="max-w-4xl mx-auto flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder="Type your message..."
                className="flex-1 bg-[#0f0f10] border-[#1f2022] text-zinc-100"
                disabled={loading}
              />
              <Button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="bg-[#8B5CF6] hover:bg-[#7C3AED]"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Tool Call Panel */}
        <ToolCallPanel calls={toolCalls} expanded={showToolPanel} />
      </div>
    </div>
  );
}
