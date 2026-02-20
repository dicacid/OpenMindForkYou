import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Plus,
  Play,
  Trash2,
  Edit,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Calendar,
  History,
  MessageCircle,
  X,
  AlertCircle
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

const SCHEDULE_PRESETS = [
  { label: 'Every hour', cron: '0 * * * *' },
  { label: 'Every morning (8 AM)', cron: '0 8 * * *' },
  { label: 'Every evening (8 PM)', cron: '0 20 * * *' },
  { label: 'Every Monday (9 AM)', cron: '0 9 * * 1' },
  { label: 'Custom', cron: '' }
];

const DELIVERY_CHANNELS = [
  { value: 'whatsapp', label: 'WhatsApp', icon: '💬' },
  { value: 'telegram', label: 'Telegram', icon: '✈️' },
  { value: 'discord', label: 'Discord', icon: '🎮' },
  { value: 'slack', label: 'Slack', icon: '💼' },
  { value: 'webchat', label: 'WebChat', icon: '💻' }
];

function StatusBadge({ status }) {
  if (status === 'success') {
    return (
      <Badge className="bg-green-500/10 text-green-400 border-green-500/20">
        <CheckCircle2 className="w-3 h-3 mr-1" />
        Success
      </Badge>
    );
  }
  if (status === 'failed') {
    return (
      <Badge className="bg-red-500/10 text-red-400 border-red-500/20">
        <XCircle className="w-3 h-3 mr-1" />
        Failed
      </Badge>
    );
  }
  return (
    <Badge className="bg-zinc-500/10 text-zinc-400 border-zinc-500/20">
      <AlertCircle className="w-3 h-3 mr-1" />
      Never Run
    </Badge>
  );
}

function ChannelIcon({ channel }) {
  const channelData = DELIVERY_CHANNELS.find(c => c.value === channel);
  return (
    <span className="text-lg" title={channelData?.label}>
      {channelData?.icon || '📱'}
    </span>
  );
}

function JobFormModal({ open, onOpenChange, job, onSave }) {
  const [formData, setFormData] = useState({
    name: '',
    cron_expression: '0 * * * *',
    prompt: '',
    delivery_channel: 'whatsapp',
    active: true
  });
  const [selectedPreset, setSelectedPreset] = useState('Every hour');
  const [cronPreview, setCronPreview] = useState('Every hour');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (job) {
        setFormData({
          name: job.name,
          cron_expression: job.cron_expression,
          prompt: job.prompt,
          delivery_channel: job.delivery_channel,
          active: job.active
        });
        setSelectedPreset('Custom');
        fetchCronPreview(job.cron_expression);
      } else {
        setFormData({
          name: '',
          cron_expression: '0 * * * *',
          prompt: '',
          delivery_channel: 'whatsapp',
          active: true
        });
        setSelectedPreset('Every hour');
        setCronPreview('Every hour');
      }
    }
  }, [open, job]);

  const fetchCronPreview = async (cron) => {
    try {
      const res = await fetch(`${API}/scheduler/parse-cron`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ cron_expression: cron })
      });
      if (res.ok) {
        const data = await res.json();
        setCronPreview(data.human_readable);
      }
    } catch (e) {
      setCronPreview('Invalid cron expression');
    }
  };

  const handlePresetSelect = (preset) => {
    setSelectedPreset(preset.label);
    if (preset.cron) {
      setFormData({ ...formData, cron_expression: preset.cron });
      fetchCronPreview(preset.cron);
    }
  };

  const handleCronChange = (cron) => {
    setFormData({ ...formData, cron_expression: cron });
    setSelectedPreset('Custom');
    fetchCronPreview(cron);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Please enter a job name');
      return;
    }
    if (!formData.cron_expression.trim()) {
      toast.error('Please enter a cron expression');
      return;
    }
    if (!formData.prompt.trim()) {
      toast.error('Please enter a prompt');
      return;
    }

    setSaving(true);
    await onSave(formData);
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#141416] border-[#1f2022] max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">
            {job ? 'Edit Job' : 'Create New Job'}
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Schedule a recurring task for your assistant to perform
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[500px] pr-4">
          <div className="space-y-4">
            {/* Job Name */}
            <div className="space-y-2">
              <Label className="text-zinc-300">Job Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Daily Weather Report"
                className="bg-[#0f0f10] border-[#1f2022] text-zinc-100"
              />
            </div>

            {/* Schedule Presets */}
            <div className="space-y-2">
              <Label className="text-zinc-300">Quick Schedule</Label>
              <div className="flex flex-wrap gap-2">
                {SCHEDULE_PRESETS.map((preset) => (
                  <Button
                    key={preset.label}
                    variant={selectedPreset === preset.label ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handlePresetSelect(preset)}
                    className={
                      selectedPreset === preset.label
                        ? 'bg-[#8B5CF6] hover:bg-[#7C3AED]'
                        : 'border-[#1f2022] hover:bg-[#1f2022]'
                    }
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Cron Expression */}
            <div className="space-y-2">
              <Label className="text-zinc-300">Cron Expression</Label>
              <Input
                value={formData.cron_expression}
                onChange={(e) => handleCronChange(e.target.value)}
                placeholder="0 * * * *"
                className="bg-[#0f0f10] border-[#1f2022] text-zinc-100 font-mono"
              />
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-zinc-500" />
                <span className="text-zinc-400">{cronPreview}</span>
              </div>
            </div>

            {/* Prompt */}
            <div className="space-y-2">
              <Label className="text-zinc-300">What should the assistant do?</Label>
              <textarea
                value={formData.prompt}
                onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                placeholder="E.g., Check the weather forecast for New York and send me a summary..."
                rows={4}
                className="w-full px-3 py-2 bg-[#0f0f10] border border-[#1f2022] rounded-md text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5CF6] resize-none"
              />
            </div>

            {/* Delivery Channel */}
            <div className="space-y-2">
              <Label className="text-zinc-300">Delivery Channel</Label>
              <select
                value={formData.delivery_channel}
                onChange={(e) => setFormData({ ...formData, delivery_channel: e.target.value })}
                className="w-full px-3 py-2 bg-[#0f0f10] border border-[#1f2022] rounded-md text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]"
              >
                {DELIVERY_CHANNELS.map((channel) => (
                  <option key={channel.value} value={channel.value}>
                    {channel.icon} {channel.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-[#0f0f10] border border-[#1f2022]">
              <div>
                <Label className="text-zinc-300">Active</Label>
                <p className="text-xs text-zinc-500">Enable this job to run on schedule</p>
              </div>
              <Switch
                checked={formData.active}
                onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-[#8B5CF6] hover:bg-[#7C3AED]">
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            {job ? 'Update Job' : 'Create Job'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResultPanel({ open, onClose, job, result }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40"
          />
          
          {/* Slide-out panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-full md:w-[600px] bg-[#141416] border-l border-[#1f2022] z-50 shadow-2xl"
          >
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-[#1f2022]">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-100">Execution Result</h3>
                  <p className="text-sm text-zinc-400 mt-1">{job?.name}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={onClose}>
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Content */}
              <ScrollArea className="flex-1 p-6">
                {result ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={result.status} />
                      <span className="text-sm text-zinc-500">
                        {new Date(result.executed_at).toLocaleString()}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-zinc-300">Output</Label>
                      <div className="p-4 rounded-lg bg-[#0f0f10] border border-[#1f2022]">
                        <pre className="text-sm text-zinc-300 whitespace-pre-wrap font-mono">
                          {result.output}
                        </pre>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-zinc-300">Prompt</Label>
                      <p className="text-sm text-zinc-400">{job?.prompt}</p>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-zinc-500">
                      <div className="flex items-center gap-1">
                        <ChannelIcon channel={job?.delivery_channel} />
                        <span>{DELIVERY_CHANNELS.find(c => c.value === job?.delivery_channel)?.label}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
                  </div>
                )}
              </ScrollArea>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default function HeartbeatSchedulerPage() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showJobModal, setShowJobModal] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [showResultPanel, setShowResultPanel] = useState(false);
  const [currentResult, setCurrentResult] = useState(null);
  const [currentJob, setCurrentJob] = useState(null);

  useEffect(() => {
    loadJobs();
    loadHistory();
  }, []);

  const loadJobs = async () => {
    try {
      const res = await fetch(`${API}/scheduler/jobs`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
      }
    } catch (e) {
      console.error('Failed to load jobs:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      const res = await fetch(`${API}/scheduler/history`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data.history || []);
      }
    } catch (e) {
      console.error('Failed to load history:', e);
    }
  };

  const handleSaveJob = async (formData) => {
    try {
      const url = editingJob ? `${API}/scheduler/jobs/${editingJob._id}` : `${API}/scheduler/jobs`;
      const method = editingJob ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData)
      });
      
      if (res.ok) {
        toast.success(editingJob ? 'Job updated' : 'Job created');
        setShowJobModal(false);
        setEditingJob(null);
        loadJobs();
      } else {
        throw new Error('Failed to save job');
      }
    } catch (e) {
      console.error('Failed to save job:', e);
      toast.error('Failed to save job');
    }
  };

  const handleDeleteJob = async (jobId) => {
    if (!confirm('Are you sure you want to delete this job?')) return;
    
    try {
      const res = await fetch(`${API}/scheduler/jobs/${jobId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        toast.success('Job deleted');
        loadJobs();
      }
    } catch (e) {
      console.error('Failed to delete job:', e);
      toast.error('Failed to delete job');
    }
  };

  const handleToggleJob = async (jobId, currentState) => {
    try {
      const res = await fetch(`${API}/scheduler/jobs/${jobId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ active: !currentState })
      });
      if (res.ok) {
        toast.success(currentState ? 'Job disabled' : 'Job enabled');
        loadJobs();
      }
    } catch (e) {
      console.error('Failed to toggle job:', e);
      toast.error('Failed to toggle job');
    }
  };

  const handleRunNow = async (job) => {
    try {
      toast.info('Running job...');
      const res = await fetch(`${API}/scheduler/jobs/${job._id}/run`, {
        method: 'POST',
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentJob(job);
        setCurrentResult(data.result);
        setShowResultPanel(true);
        loadJobs();
        loadHistory();
      }
    } catch (e) {
      console.error('Failed to run job:', e);
      toast.error('Failed to run job');
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
                <Clock className="w-5 h-5 text-[#8B5CF6]" />
                Heartbeat Scheduler
              </h1>
            </div>
            <Button
              onClick={() => {
                setEditingJob(null);
                setShowJobModal(true);
              }}
              className="bg-[#8B5CF6] hover:bg-[#7C3AED]"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Job
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 py-6">
        <Tabs defaultValue="jobs" className="space-y-6">
          <TabsList className="bg-[#141416] border border-[#1f2022]">
            <TabsTrigger value="jobs" className="data-[state=active]:bg-[#8B5CF6]">
              <Calendar className="w-4 h-4 mr-2" />
              Jobs ({jobs.length})
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-[#8B5CF6]">
              <History className="w-4 h-4 mr-2" />
              History
            </TabsTrigger>
          </TabsList>

          {/* Jobs Tab */}
          <TabsContent value="jobs">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
              </div>
            ) : jobs.length === 0 ? (
              <Card className="border-[#1f2022] bg-[#141416]/95">
                <CardContent className="py-12 text-center">
                  <Clock className="w-12 h-12 mx-auto mb-3 text-zinc-600" />
                  <p className="text-zinc-400 mb-4">No scheduled jobs yet</p>
                  <Button
                    onClick={() => setShowJobModal(true)}
                    className="bg-[#8B5CF6] hover:bg-[#7C3AED]"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Job
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {jobs.map((job) => (
                  <motion.div
                    key={job._id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card className="border-[#1f2022] bg-[#141416]/95 hover:border-[#2f3032] transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          {/* Job Info */}
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-3">
                              <h3 className="text-lg font-medium text-zinc-100">{job.name}</h3>
                              {job.active ? (
                                <Badge className="bg-green-500/10 text-green-400 border-green-500/20">Active</Badge>
                              ) : (
                                <Badge className="bg-zinc-500/10 text-zinc-400 border-zinc-500/20">Inactive</Badge>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-4 text-sm text-zinc-400">
                              <div className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                <span>{job.schedule_summary || 'Custom schedule'}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <ChannelIcon channel={job.delivery_channel} />
                                <span>{DELIVERY_CHANNELS.find(c => c.value === job.delivery_channel)?.label}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-6 text-xs text-zinc-500">
                              <div>
                                Status: <StatusBadge status={job.last_run_status} />
                              </div>
                              {job.last_run_at && (
                                <div>Last run: {new Date(job.last_run_at).toLocaleString()}</div>
                              )}
                              {job.next_run_at && (
                                <div>Next run: {new Date(job.next_run_at).toLocaleString()}</div>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRunNow(job)}
                              className="border-[#1f2022] hover:bg-[#1f2022]"
                            >
                              <Play className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingJob(job);
                                setShowJobModal(true);
                              }}
                              className="border-[#1f2022] hover:bg-[#1f2022]"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleJob(job._id, job.active)}
                              className="border-[#1f2022] hover:bg-[#1f2022]"
                            >
                              <Switch checked={job.active} className="pointer-events-none" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteJob(job._id)}
                              className="border-[#1f2022] hover:bg-red-950/20 hover:text-red-400"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history">
            <Card className="border-[#1f2022] bg-[#141416]/95">
              <CardHeader>
                <CardTitle className="text-zinc-100">Execution History</CardTitle>
                <CardDescription className="text-zinc-400">
                  Recent job executions and their results
                </CardDescription>
              </CardHeader>
              <CardContent>
                {history.length === 0 ? (
                  <div className="text-center py-8 text-zinc-500">
                    <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No execution history yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {history.map((log, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-lg bg-[#0f0f10] border border-[#1f2022] hover:border-[#2f3032] transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-zinc-200">{log.job_name}</span>
                            <StatusBadge status={log.status} />
                          </div>
                          <p className="text-xs text-zinc-500 truncate max-w-xl">{log.output}</p>
                        </div>
                        <span className="text-xs text-zinc-600">
                          {new Date(log.executed_at).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Modals */}
      <JobFormModal
        open={showJobModal}
        onOpenChange={setShowJobModal}
        job={editingJob}
        onSave={handleSaveJob}
      />

      <ResultPanel
        open={showResultPanel}
        onClose={() => setShowResultPanel(false)}
        job={currentJob}
        result={currentResult}
      />
    </div>
  );
}
