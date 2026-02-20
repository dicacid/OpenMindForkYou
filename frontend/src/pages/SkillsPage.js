import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Search,
  ArrowLeft,
  Download,
  Trash2,
  Settings,
  Star,
  ToggleLeft,
  ToggleRight,
  Loader2,
  Sparkles,
  Package
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

// Mock skills registry
const MOCK_SKILLS = [
  {
    id: 'weather',
    name: 'Weather',
    icon: '🌤️',
    description: 'Get accurate weather forecasts for any location worldwide',
    version: '1.2.0',
    author: 'OpenMind Team',
    category: 'Productivity',
    rating: 4.8,
    downloads: 15420,
    config: {
      apiKey: { type: 'text', label: 'API Key', placeholder: 'Enter OpenWeather API key', required: true },
      defaultLocation: { type: 'text', label: 'Default Location', placeholder: 'e.g., New York, US', required: false },
      units: { type: 'select', label: 'Units', options: ['metric', 'imperial'], default: 'metric' }
    }
  },
  {
    id: 'github',
    name: 'GitHub',
    icon: '🐙',
    description: 'Manage repositories, pull requests, issues, and view code',
    version: '2.0.1',
    author: 'DevTools Community',
    category: 'Developer Tools',
    rating: 4.9,
    downloads: 28350,
    config: {
      token: { type: 'text', label: 'Personal Access Token', placeholder: 'ghp_...', required: true },
      defaultOrg: { type: 'text', label: 'Default Organization', placeholder: 'e.g., facebook', required: false }
    }
  },
  {
    id: 'websearch',
    name: 'Web Search',
    icon: '🔍',
    description: 'Search the internet and get real-time information via API',
    version: '1.5.2',
    author: 'OpenMind Team',
    category: 'Data',
    rating: 4.7,
    downloads: 32100,
    config: {
      provider: { type: 'select', label: 'Search Provider', options: ['Google', 'Bing', 'DuckDuckGo'], default: 'Google' },
      apiKey: { type: 'text', label: 'API Key', placeholder: 'Enter search API key', required: true },
      maxResults: { type: 'number', label: 'Max Results', default: 10 }
    }
  },
  {
    id: 'calendar',
    name: 'Calendar',
    icon: '📅',
    description: 'Read and write Google Calendar events, set reminders',
    version: '1.8.0',
    author: 'Productivity Hub',
    category: 'Productivity',
    rating: 4.6,
    downloads: 18750,
    config: {
      clientId: { type: 'text', label: 'Google Client ID', placeholder: 'xxx.apps.googleusercontent.com', required: true },
      clientSecret: { type: 'text', label: 'Client Secret', placeholder: 'GOCSPX-...', required: true },
      defaultCalendar: { type: 'text', label: 'Default Calendar', placeholder: 'primary', default: 'primary' }
    }
  },
  {
    id: 'email',
    name: 'Email',
    icon: '📧',
    description: 'Read, send, and manage Gmail messages with full search',
    version: '2.1.0',
    author: 'Communication Suite',
    category: 'Communication',
    rating: 4.5,
    downloads: 21600,
    config: {
      email: { type: 'text', label: 'Gmail Address', placeholder: 'you@gmail.com', required: true },
      appPassword: { type: 'text', label: 'App Password', placeholder: '16-character password', required: true },
      signature: { type: 'textarea', label: 'Email Signature', placeholder: 'Your signature', required: false }
    }
  },
  {
    id: 'notes',
    name: 'Notes',
    icon: '📝',
    description: 'Read and write Obsidian-style Markdown notes with linking',
    version: '1.4.3',
    author: 'Note Wizards',
    category: 'Productivity',
    rating: 4.8,
    downloads: 14200,
    config: {
      vaultPath: { type: 'text', label: 'Vault Path', placeholder: '/path/to/vault', required: true },
      defaultFolder: { type: 'text', label: 'Default Folder', placeholder: 'Daily Notes', required: false },
      autoLink: { type: 'boolean', label: 'Auto-link notes', default: true }
    }
  },
  {
    id: 'news',
    name: 'News',
    icon: '📰',
    description: 'Fetch and summarize top headlines from trusted sources',
    version: '1.3.0',
    author: 'InfoStream',
    category: 'Data',
    rating: 4.4,
    downloads: 9800,
    config: {
      apiKey: { type: 'text', label: 'News API Key', placeholder: 'Enter NewsAPI key', required: true },
      country: { type: 'select', label: 'Country', options: ['us', 'uk', 'ca', 'au', 'in'], default: 'us' },
      sources: { type: 'text', label: 'Preferred Sources', placeholder: 'bbc-news, cnn', required: false }
    }
  },
  {
    id: 'imagegen',
    name: 'Image Generator',
    icon: '🎨',
    description: 'Generate stunning images using AI models like DALL-E',
    version: '2.3.0',
    author: 'Creative AI',
    category: 'Creative',
    rating: 4.9,
    downloads: 45600,
    config: {
      provider: { type: 'select', label: 'AI Provider', options: ['DALL-E', 'Midjourney', 'Stable Diffusion'], default: 'DALL-E' },
      apiKey: { type: 'text', label: 'API Key', placeholder: 'Enter API key', required: true },
      defaultStyle: { type: 'text', label: 'Default Style', placeholder: 'e.g., photorealistic', required: false }
    }
  },
  {
    id: 'transcribe',
    name: 'Audio Transcribe',
    icon: '🎙️',
    description: 'Transcribe audio files to text with high accuracy',
    version: '1.6.1',
    author: 'AudioTech',
    category: 'Creative',
    rating: 4.7,
    downloads: 12300,
    config: {
      apiKey: { type: 'text', label: 'Whisper API Key', placeholder: 'Enter OpenAI key', required: true },
      language: { type: 'select', label: 'Default Language', options: ['auto', 'en', 'es', 'fr', 'de'], default: 'auto' },
      timestamps: { type: 'boolean', label: 'Include Timestamps', default: true }
    }
  },
  {
    id: 'coderunner',
    name: 'Code Runner',
    icon: '⚡',
    description: 'Execute Python code snippets safely in a sandbox',
    version: '1.9.0',
    author: 'DevTools Community',
    category: 'Developer Tools',
    rating: 4.6,
    downloads: 19400,
    config: {
      timeout: { type: 'number', label: 'Execution Timeout (seconds)', default: 30 },
      maxMemory: { type: 'number', label: 'Max Memory (MB)', default: 512 },
      allowNetwork: { type: 'boolean', label: 'Allow Network Access', default: false }
    }
  },
  {
    id: 'crypto',
    name: 'Crypto Tracker',
    icon: '₿',
    description: 'Track live cryptocurrency prices and portfolio values',
    version: '2.2.0',
    author: 'FinTech Labs',
    category: 'Data',
    rating: 4.5,
    downloads: 16800,
    config: {
      apiKey: { type: 'text', label: 'CoinGecko API Key', placeholder: 'Enter API key', required: false },
      defaultCurrency: { type: 'select', label: 'Base Currency', options: ['USD', 'EUR', 'GBP', 'BTC'], default: 'USD' },
      refreshInterval: { type: 'number', label: 'Refresh Interval (seconds)', default: 60 }
    }
  },
  {
    id: 'youtube',
    name: 'YouTube Summarizer',
    icon: '📺',
    description: 'Summarize YouTube videos by URL with key timestamps',
    version: '1.7.2',
    author: 'Media Tools',
    category: 'Communication',
    rating: 4.8,
    downloads: 22900,
    config: {
      apiKey: { type: 'text', label: 'YouTube API Key', placeholder: 'Enter Google API key', required: true },
      summaryLength: { type: 'select', label: 'Summary Length', options: ['short', 'medium', 'detailed'], default: 'medium' },
      includeTimestamps: { type: 'boolean', label: 'Include Timestamps', default: true }
    }
  }
];

const CATEGORIES = ['All', 'Productivity', 'Developer Tools', 'Communication', 'Data', 'Creative'];

function CategoryBadge({ category }) {
  const colors = {
    'Productivity': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    'Developer Tools': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    'Communication': 'bg-green-500/10 text-green-400 border-green-500/20',
    'Data': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    'Creative': 'bg-pink-500/10 text-pink-400 border-pink-500/20'
  };

  return (
    <Badge className={`${colors[category] || 'bg-zinc-500/10 text-zinc-400'} border`}>
      {category}
    </Badge>
  );
}

function SkillCard({ skill, isInstalled, onInstall, onUninstall, onConfigure, onToggle, isEnabled }) {
  const [loading, setLoading] = useState(false);

  const handleAction = async (action) => {
    setLoading(true);
    await action();
    setLoading(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="h-full"
    >
      <Card className="border-[#1f2022] bg-[#141416]/95 h-full flex flex-col">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="text-4xl">{skill.icon}</div>
              <div>
                <CardTitle className="text-zinc-100 text-lg">{skill.name}</CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <CategoryBadge category={skill.category} />
                  <span className="text-xs text-zinc-500">v{skill.version}</span>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1">
          <p className="text-sm text-zinc-400 mb-4">{skill.description}</p>
          
          <div className="flex items-center gap-4 text-xs text-zinc-500">
            <div className="flex items-center gap-1">
              <Star className="w-3.5 h-3.5 fill-yellow-500 text-yellow-500" />
              <span>{skill.rating}</span>
            </div>
            <div className="flex items-center gap-1">
              <Download className="w-3.5 h-3.5" />
              <span>{(skill.downloads / 1000).toFixed(1)}k</span>
            </div>
            <div className="text-zinc-600">by {skill.author}</div>
          </div>
        </CardContent>

        <CardFooter className="flex gap-2">
          {isInstalled ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAction(onToggle)}
                className="flex-1 border-[#1f2022] hover:bg-[#1f2022]"
              >
                {isEnabled ? (
                  <ToggleRight className="w-4 h-4 mr-2 text-green-500" />
                ) : (
                  <ToggleLeft className="w-4 h-4 mr-2 text-zinc-500" />
                )}
                {isEnabled ? 'Enabled' : 'Disabled'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onConfigure}
                className="border-[#1f2022] hover:bg-[#1f2022]"
              >
                <Settings className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAction(onUninstall)}
                className="border-[#1f2022] hover:bg-red-950/20 hover:text-red-400"
                disabled={loading}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <Button
              onClick={() => handleAction(onInstall)}
              disabled={loading}
              className="w-full bg-[#FF4500] hover:bg-[#E63E00]"
              size="sm"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Install
            </Button>
          )}
        </CardFooter>
      </Card>
    </motion.div>
  );
}

function ConfigureModal({ open, onOpenChange, skill, config, onSave }) {
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && skill) {
      // Initialize form with current config or defaults
      const initial = {};
      Object.entries(skill.config).forEach(([key, field]) => {
        initial[key] = config?.[key] || field.default || '';
      });
      setFormData(initial);
    }
  }, [open, skill, config]);

  const handleSave = async () => {
    setSaving(true);
    await onSave(formData);
    setSaving(false);
    onOpenChange(false);
  };

  if (!skill) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#141416] border-[#1f2022] max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-zinc-100 flex items-center gap-2">
            <span className="text-2xl">{skill.icon}</span>
            Configure {skill.name}
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Set up API keys and preferences for this skill
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[500px] pr-4">
          <div className="space-y-4">
            {Object.entries(skill.config).map(([key, field]) => (
              <div key={key} className="space-y-2">
                <Label className="text-zinc-300">
                  {field.label}
                  {field.required && <span className="text-red-400 ml-1">*</span>}
                </Label>
                
                {field.type === 'text' && (
                  <Input
                    type="text"
                    value={formData[key] || ''}
                    onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                    placeholder={field.placeholder}
                    className="bg-[#0f0f10] border-[#1f2022] text-zinc-100"
                  />
                )}
                
                {field.type === 'textarea' && (
                  <textarea
                    value={formData[key] || ''}
                    onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                    placeholder={field.placeholder}
                    rows={3}
                    className="w-full px-3 py-2 bg-[#0f0f10] border border-[#1f2022] rounded-md text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF4500] resize-none"
                  />
                )}
                
                {field.type === 'select' && (
                  <select
                    value={formData[key] || field.default}
                    onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0f0f10] border border-[#1f2022] rounded-md text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF4500]"
                  >
                    {field.options.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                )}
                
                {field.type === 'number' && (
                  <Input
                    type="number"
                    value={formData[key] || field.default || ''}
                    onChange={(e) => setFormData({ ...formData, [key]: parseInt(e.target.value) })}
                    className="bg-[#0f0f10] border-[#1f2022] text-zinc-100"
                  />
                )}
                
                {field.type === 'boolean' && (
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData[key] !== undefined ? formData[key] : field.default}
                      onCheckedChange={(checked) => setFormData({ ...formData, [key]: checked })}
                    />
                    <span className="text-sm text-zinc-400">
                      {formData[key] !== undefined ? (formData[key] ? 'Enabled' : 'Disabled') : (field.default ? 'Enabled' : 'Disabled')}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-[#FF4500] hover:bg-[#E63E00]">
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Settings className="w-4 h-4 mr-2" />
            )}
            Save Configuration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function SkillsPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [installedSkills, setInstalledSkills] = useState([]);
  const [activeTab, setActiveTab] = useState('registry');
  const [configureSkill, setConfigureSkill] = useState(null);
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Load installed skills on mount
  useEffect(() => {
    loadInstalledSkills();
  }, []);

  const loadInstalledSkills = async () => {
    try {
      const res = await fetch(`${API}/skills/installed`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setInstalledSkills(data.skills || []);
      }
    } catch (e) {
      console.error('Failed to load installed skills:', e);
    }
  };

  const handleInstall = async (skillId) => {
    try {
      const res = await fetch(`${API}/skills/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ skill_id: skillId })
      });
      if (res.ok) {
        toast.success('Skill installed successfully');
        loadInstalledSkills();
      } else {
        throw new Error('Installation failed');
      }
    } catch (e) {
      console.error('Failed to install skill:', e);
      toast.error('Failed to install skill');
    }
  };

  const handleUninstall = async (skillId) => {
    try {
      const res = await fetch(`${API}/skills/uninstall`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ skill_id: skillId })
      });
      if (res.ok) {
        toast.success('Skill uninstalled');
        loadInstalledSkills();
      }
    } catch (e) {
      console.error('Failed to uninstall skill:', e);
      toast.error('Failed to uninstall skill');
    }
  };

  const handleToggle = async (skillId) => {
    const skill = installedSkills.find(s => s.skill_id === skillId);
    const newState = !skill?.enabled;

    try {
      const res = await fetch(`${API}/skills/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ skill_id: skillId, enabled: newState })
      });
      if (res.ok) {
        toast.success(newState ? 'Skill enabled' : 'Skill disabled');
        loadInstalledSkills();
      }
    } catch (e) {
      console.error('Failed to toggle skill:', e);
      toast.error('Failed to toggle skill');
    }
  };

  const handleSaveConfig = async (config) => {
    try {
      const res = await fetch(`${API}/skills/configure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ skill_id: configureSkill.id, config })
      });
      if (res.ok) {
        toast.success('Configuration saved');
        loadInstalledSkills();
      }
    } catch (e) {
      console.error('Failed to save config:', e);
      toast.error('Failed to save configuration');
    }
  };

  const filteredSkills = useMemo(() => {
    return MOCK_SKILLS.filter(skill => {
      const matchesSearch = skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           skill.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || skill.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  const installedSkillsData = useMemo(() => {
    return installedSkills.map(installed => {
      const skill = MOCK_SKILLS.find(s => s.id === installed.skill_id);
      return { ...skill, ...installed };
    });
  }, [installedSkills]);

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
              <div className="h-6 w-px bg-[#1f2022]" />
              <h1 className="heading text-xl font-semibold flex items-center gap-2">
                <Package className="w-5 h-5 text-[#FF4500]" />
                MindHub Skills
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-[#141416] border border-[#1f2022]">
            <TabsTrigger value="registry" className="data-[state=active]:bg-[#FF4500]">
              <Sparkles className="w-4 h-4 mr-2" />
              Registry ({MOCK_SKILLS.length})
            </TabsTrigger>
            <TabsTrigger value="installed" className="data-[state=active]:bg-[#FF4500]">
              <Package className="w-4 h-4 mr-2" />
              Installed ({installedSkills.length})
            </TabsTrigger>
          </TabsList>

          {/* Registry Tab */}
          <TabsContent value="registry" className="space-y-6">
            {/* Search and Filters */}
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <Input
                  type="text"
                  placeholder="Search skills..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-[#141416] border-[#1f2022] text-zinc-100"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <Button
                    key={cat}
                    variant={selectedCategory === cat ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedCategory(cat)}
                    className={
                      selectedCategory === cat
                        ? 'bg-[#FF4500] hover:bg-[#E63E00]'
                        : 'border-[#1f2022] hover:bg-[#1f2022]'
                    }
                  >
                    {cat}
                  </Button>
                ))}
              </div>
            </div>

            {/* Skills Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence mode="popLayout">
                {filteredSkills.map((skill) => {
                  const isInstalled = installedSkills.some(s => s.skill_id === skill.id);
                  return (
                    <SkillCard
                      key={skill.id}
                      skill={skill}
                      isInstalled={isInstalled}
                      onInstall={() => handleInstall(skill.id)}
                    />
                  );
                })}
              </AnimatePresence>
            </div>

            {filteredSkills.length === 0 && (
              <div className="text-center py-12 text-zinc-500">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No skills found matching your search</p>
              </div>
            )}
          </TabsContent>

          {/* Installed Tab */}
          <TabsContent value="installed" className="space-y-6">
            {installedSkillsData.length === 0 ? (
              <div className="text-center py-12 text-zinc-500">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No skills installed yet</p>
                <Button
                  onClick={() => setActiveTab('registry')}
                  className="mt-4 bg-[#FF4500] hover:bg-[#E63E00]"
                  size="sm"
                >
                  Browse Registry
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {installedSkillsData.map((skill) => (
                  <SkillCard
                    key={skill.id}
                    skill={skill}
                    isInstalled={true}
                    isEnabled={skill.enabled}
                    onUninstall={() => handleUninstall(skill.id)}
                    onToggle={() => handleToggle(skill.id)}
                    onConfigure={() => {
                      setConfigureSkill(skill);
                      setShowConfigModal(true);
                    }}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Configure Modal */}
      <ConfigureModal
        open={showConfigModal}
        onOpenChange={setShowConfigModal}
        skill={configureSkill}
        config={installedSkills.find(s => s.skill_id === configureSkill?.id)?.config}
        onSave={handleSaveConfig}
      />
    </div>
  );
}
