import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Save,
  RefreshCw,
  Plus,
  Trash2,
  Clock,
  FileText,
  Brain,
  Sparkles,
  ArrowLeft,
  Type,
  Hash,
  CalendarClock,
  RotateCcw
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

function StatsBar({ content, lastModified }) {
  const stats = useMemo(() => {
    const words = content.split(/\s+/).filter(Boolean).length;
    const chars = content.length;
    const tokens = Math.ceil(chars / 4); // 1 token ≈ 4 chars
    return { words, chars, tokens };
  }, [content]);

  const modifiedDate = useMemo(() => {
    if (!lastModified) return 'Never';
    const date = new Date(lastModified);
    return date.toLocaleString();
  }, [lastModified]);

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-[#0f0f10] border-b border-[#1f2022] text-xs text-zinc-400">
      <div className="flex items-center gap-1.5">
        <Type className="w-3.5 h-3.5" />
        <span>{stats.words.toLocaleString()} words</span>
      </div>
      <Separator orientation="vertical" className="h-4" />
      <div className="flex items-center gap-1.5">
        <Hash className="w-3.5 h-3.5" />
        <span>{stats.tokens.toLocaleString()} tokens</span>
      </div>
      <Separator orientation="vertical" className="h-4" />
      <div className="flex items-center gap-1.5">
        <CalendarClock className="w-3.5 h-3.5" />
        <span>Modified: {modifiedDate}</span>
      </div>
    </div>
  );
}

function AddMemoryDialog({ open, onOpenChange, onAdd }) {
  const [type, setType] = useState('fact');
  const [content, setContent] = useState('');

  const handleAdd = () => {
    if (!content.trim()) {
      toast.error('Please enter some content');
      return;
    }
    onAdd(type, content);
    setContent('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#141416] border-[#1f2022]">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">Add Memory Entry</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Add a new fact, preference, or project to your memory.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm text-zinc-300">Entry Type</label>
            <div className="flex gap-2">
              {['fact', 'preference', 'project'].map((t) => (
                <Button
                  key={t}
                  variant={type === t ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setType(t)}
                  className={type === t ? 'bg-[#8B5CF6] hover:bg-[#7C3AED]' : ''}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Button>
              ))}
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm text-zinc-300">Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={`Enter your ${type} here...`}
              className="w-full h-32 px-3 py-2 bg-[#0f0f10] border border-[#1f2022] rounded-md text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5CF6] resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAdd} className="bg-[#8B5CF6] hover:bg-[#7C3AED]">
            <Plus className="w-4 h-4 mr-2" />
            Add Entry
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummarizeDialog({ open, onOpenChange, content, onConfirm }) {
  const [summarizing, setSummarizing] = useState(false);
  const [summary, setSummary] = useState('');

  useEffect(() => {
    if (open && !summary) {
      // Simulate AI summarization (in real app, call API)
      setSummarizing(true);
      setTimeout(() => {
        const lines = content.split('\n').filter(l => l.trim());
        const compressed = lines.slice(0, Math.ceil(lines.length / 2)).join('\n');
        setSummary(compressed || 'No content to summarize.');
        setSummarizing(false);
      }, 1500);
    }
  }, [open, content, summary]);

  const handleConfirm = () => {
    onConfirm(summary);
    setSummary('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#141416] border-[#1f2022] max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">Summarize Memory</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Preview what the AI would compress your memory down to. Approve to save.
          </DialogDescription>
        </DialogHeader>
        
        {summarizing ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3 text-zinc-400">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Generating summary...</span>
            </div>
          </div>
        ) : (
          <ScrollArea className="h-[400px] w-full rounded border border-[#1f2022] bg-[#0f0f10] p-4">
            <pre className="text-sm text-zinc-300 whitespace-pre-wrap font-mono">
              {summary}
            </pre>
          </ScrollArea>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={summarizing}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={summarizing}
            className="bg-[#8B5CF6] hover:bg-[#7C3AED]"
          >
            <Save className="w-4 h-4 mr-2" />
            Approve & Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MemoryTimeline({ entries, onDelete }) {
  return (
    <Card className="border-[#1f2022] bg-[#141416]/95">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-zinc-100">
          <Clock className="w-5 h-5" />
          Memory Timeline
        </CardTitle>
        <CardDescription className="text-zinc-400">
          Chronological feed of what the assistant has learned
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px] pr-4">
          {entries.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">
              <Brain className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No memory entries yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {entries.map((entry, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="group relative p-4 rounded-lg border border-[#1f2022] bg-[#0f0f10] hover:border-[#2f3032] transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-[#8B5CF6] px-2 py-0.5 rounded bg-[#8B5CF6]/10">
                          {entry.type}
                        </span>
                        <span className="text-xs text-zinc-500">{entry.timestamp}</span>
                      </div>
                      <p className="text-sm text-zinc-300 leading-relaxed">{entry.content}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(idx)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-red-400 hover:bg-red-950/20"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export default function MemoryManagerPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('memory');
  
  // Memory state
  const [memoryContent, setMemoryContent] = useState('');
  const [memoryLastModified, setMemoryLastModified] = useState(null);
  const [memoryLoading, setMemoryLoading] = useState(true);
  
  // Soul state
  const [soulContent, setSoulContent] = useState('');
  const [soulLastModified, setSoulLastModified] = useState(null);
  const [soulLoading, setSoulLoading] = useState(true);
  
  // Timeline state
  const [timelineEntries, setTimelineEntries] = useState([]);
  
  // Dialog state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showSummarizeDialog, setShowSummarizeDialog] = useState(false);
  
  const [saving, setSaving] = useState(false);

  // Load memory data
  useEffect(() => {
    loadMemory();
    loadSoul();
    loadTimeline();
  }, []);

  const loadMemory = async () => {
    try {
      const res = await fetch(`${API}/memory/get`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setMemoryContent(data.content);
        setMemoryLastModified(data.last_modified);
      }
    } catch (e) {
      console.error('Failed to load memory:', e);
      toast.error('Failed to load memory');
    } finally {
      setMemoryLoading(false);
    }
  };

  const loadSoul = async () => {
    try {
      const res = await fetch(`${API}/soul/get`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setSoulContent(data.content);
        setSoulLastModified(data.last_modified);
      }
    } catch (e) {
      console.error('Failed to load soul:', e);
      toast.error('Failed to load personality');
    } finally {
      setSoulLoading(false);
    }
  };

  const loadTimeline = async () => {
    try {
      const res = await fetch(`${API}/memory/timeline`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setTimelineEntries(data.entries || []);
      }
    } catch (e) {
      console.error('Failed to load timeline:', e);
    }
  };

  const saveMemory = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/memory/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content: memoryContent })
      });
      if (res.ok) {
        const data = await res.json();
        setMemoryLastModified(data.last_modified);
        toast.success('Memory saved');
      } else {
        throw new Error('Save failed');
      }
    } catch (e) {
      console.error('Failed to save memory:', e);
      toast.error('Failed to save memory');
    } finally {
      setSaving(false);
    }
  };

  const saveSoul = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/soul/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content: soulContent })
      });
      if (res.ok) {
        const data = await res.json();
        setSoulLastModified(data.last_modified);
        toast.success('Personality saved');
      } else {
        throw new Error('Save failed');
      }
    } catch (e) {
      console.error('Failed to save soul:', e);
      toast.error('Failed to save personality');
    } finally {
      setSaving(false);
    }
  };

  const handleAddMemoryEntry = async (type, content) => {
    try {
      const res = await fetch(`${API}/memory/add-entry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type, content })
      });
      if (res.ok) {
        const data = await res.json();
        setMemoryContent(data.content);
        toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} added`);
        loadTimeline();
      }
    } catch (e) {
      console.error('Failed to add entry:', e);
      toast.error('Failed to add entry');
    }
  };

  const handleClearSection = async (sectionType) => {
    try {
      const res = await fetch(`${API}/memory/clear-section`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ section_type: sectionType })
      });
      if (res.ok) {
        const data = await res.json();
        setMemoryContent(data.content);
        toast.success(`${sectionType} section cleared`);
      }
    } catch (e) {
      console.error('Failed to clear section:', e);
      toast.error('Failed to clear section');
    }
  };

  const handleResetSoul = async () => {
    try {
      const res = await fetch(`${API}/soul/reset`, {
        method: 'POST',
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setSoulContent(data.content);
        toast.success('Personality reset to default');
      }
    } catch (e) {
      console.error('Failed to reset soul:', e);
      toast.error('Failed to reset personality');
    }
  };

  const handleSummarize = (summary) => {
    setMemoryContent(summary);
    saveMemory();
  };

  const handleDeleteTimelineEntry = async (index) => {
    try {
      const res = await fetch(`${API}/memory/timeline/${index}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        toast.success('Entry deleted');
        loadTimeline();
      }
    } catch (e) {
      console.error('Failed to delete entry:', e);
      toast.error('Failed to delete entry');
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f10] text-zinc-100">
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
                Back to Setup
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <h1 className="heading text-xl font-semibold flex items-center gap-2">
                <Brain className="w-5 h-5 text-[#8B5CF6]" />
                Memory Manager
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-[#141416] border border-[#1f2022]">
            <TabsTrigger value="memory" className="data-[state=active]:bg-[#8B5CF6]">
              <FileText className="w-4 h-4 mr-2" />
              MEMORY.md
            </TabsTrigger>
            <TabsTrigger value="soul" className="data-[state=active]:bg-[#8B5CF6]">
              <Sparkles className="w-4 h-4 mr-2" />
              SOUL.md
            </TabsTrigger>
            <TabsTrigger value="timeline" className="data-[state=active]:bg-[#8B5CF6]">
              <Clock className="w-4 h-4 mr-2" />
              Timeline
            </TabsTrigger>
          </TabsList>

          {/* MEMORY.md Tab */}
          <TabsContent value="memory" className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-zinc-400">
                Edit your assistant's memory in Markdown format
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddDialog(true)}
                  className="border-[#1f2022] hover:bg-[#1f2022]"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Entry
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSummarizeDialog(true)}
                  className="border-[#1f2022] hover:bg-[#1f2022]"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Summarize
                </Button>
                <Button
                  size="sm"
                  onClick={saveMemory}
                  disabled={saving}
                  className="bg-[#8B5CF6] hover:bg-[#7C3AED]"
                >
                  {saving ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save
                </Button>
              </div>
            </div>

            <Card className="border-[#1f2022] bg-[#141416]/95 overflow-hidden">
              <StatsBar content={memoryContent} lastModified={memoryLastModified} />
              
              {memoryLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-6 h-6 animate-spin text-zinc-500" />
                </div>
              ) : (
                <PanelGroup direction="horizontal">
                  <Panel defaultSize={50} minSize={30}>
                    <div className="h-[600px] flex flex-col">
                      <div className="px-4 py-2 bg-[#0f0f10] border-b border-[#1f2022] text-xs text-zinc-500 font-medium">
                        EDITOR
                      </div>
                      <textarea
                        value={memoryContent}
                        onChange={(e) => setMemoryContent(e.target.value)}
                        className="flex-1 w-full px-4 py-3 bg-[#0f0f10] text-zinc-100 text-sm font-mono focus:outline-none resize-none"
                        placeholder="# Memory\n\nStart writing your memory here..."
                      />
                    </div>
                  </Panel>
                  
                  <PanelResizeHandle className="w-1 bg-[#1f2022] hover:bg-[#8B5CF6] transition-colors" />
                  
                  <Panel defaultSize={50} minSize={30}>
                    <div className="h-[600px] flex flex-col">
                      <div className="px-4 py-2 bg-[#0f0f10] border-b border-[#1f2022] text-xs text-zinc-500 font-medium">
                        PREVIEW
                      </div>
                      <ScrollArea className="flex-1">
                        <div className="px-4 py-3 prose prose-invert prose-sm max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {memoryContent || '*No content to preview*'}
                          </ReactMarkdown>
                        </div>
                      </ScrollArea>
                    </div>
                  </Panel>
                </PanelGroup>
              )}
            </Card>
          </TabsContent>

          {/* SOUL.md Tab */}
          <TabsContent value="soul" className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-zinc-400">
                Define your assistant's personality and behavior
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetSoul}
                  className="border-[#1f2022] hover:bg-[#1f2022]"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset to Default
                </Button>
                <Button
                  size="sm"
                  onClick={saveSoul}
                  disabled={saving}
                  className="bg-[#8B5CF6] hover:bg-[#7C3AED]"
                >
                  {saving ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save
                </Button>
              </div>
            </div>

            <Card className="border-[#1f2022] bg-[#141416]/95 overflow-hidden">
              <StatsBar content={soulContent} lastModified={soulLastModified} />
              
              {soulLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-6 h-6 animate-spin text-zinc-500" />
                </div>
              ) : (
                <div className="h-[600px]">
                  <textarea
                    value={soulContent}
                    onChange={(e) => setSoulContent(e.target.value)}
                    className="w-full h-full px-4 py-3 bg-[#0f0f10] text-zinc-100 text-sm font-mono focus:outline-none resize-none"
                    placeholder="# Personality\n\nDefine your assistant's personality..."
                  />
                </div>
              )}
            </Card>
          </TabsContent>

          {/* Timeline Tab */}
          <TabsContent value="timeline">
            <MemoryTimeline 
              entries={timelineEntries} 
              onDelete={handleDeleteTimelineEntry}
            />
          </TabsContent>
        </Tabs>
      </main>

      {/* Dialogs */}
      <AddMemoryDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onAdd={handleAddMemoryEntry}
      />
      
      <SummarizeDialog
        open={showSummarizeDialog}
        onOpenChange={setShowSummarizeDialog}
        content={memoryContent}
        onConfirm={handleSummarize}
      />
    </div>
  );
}
