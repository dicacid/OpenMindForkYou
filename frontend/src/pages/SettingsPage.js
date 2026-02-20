import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Download,
  Search,
  Settings as SettingsIcon,
  User,
  Bell,
  Shield,
  History,
  FileText,
  Loader2
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

function AuditLogTab() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadAuditLogs();
  }, []);

  const loadAuditLogs = async () => {
    try {
      const res = await fetch(`${API}/audit/logs`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (e) {
      console.error('Failed to load audit logs:', e);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['Timestamp', 'Tool Name', 'Arguments', 'Result', 'Session ID'];
    const rows = logs.map(log => [
      new Date(log.timestamp).toLocaleString(),
      log.tool_name,
      JSON.stringify(log.arguments).substring(0, 100),
      JSON.stringify(log.result).substring(0, 100),
      log.session_id
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${Date.now()}.csv`;
    a.click();
    toast.success('Audit log exported');
  };

  const filteredLogs = logs.filter(log =>
    log.tool_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.session_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search logs..."
            className="pl-10 bg-[#0f0f10] border-[#1f2022] text-zinc-100"
          />
        </div>
        <Button
          onClick={exportToCSV}
          disabled={logs.length === 0}
          className="bg-[#FF4500] hover:bg-[#E63E00]"
        >
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
        </div>
      ) : filteredLogs.length === 0 ? (
        <Card className="border-[#1f2022] bg-[#141416]/95">
          <CardContent className="py-12 text-center text-zinc-500">
            <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No audit logs found</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-[#1f2022] bg-[#141416]/95">
          <ScrollArea className="h-[600px]">
            <div className="p-4">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#1f2022] text-left">
                    <th className="pb-3 text-sm font-medium text-zinc-400">Timestamp</th>
                    <th className="pb-3 text-sm font-medium text-zinc-400">Tool</th>
                    <th className="pb-3 text-sm font-medium text-zinc-400">Arguments</th>
                    <th className="pb-3 text-sm font-medium text-zinc-400">Result</th>
                    <th className="pb-3 text-sm font-medium text-zinc-400">Session</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log, idx) => (
                    <tr key={idx} className="border-b border-[#1f2022]/50">
                      <td className="py-3 text-sm text-zinc-300">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="py-3">
                        <Badge className="bg-[#FF4500]/10 text-[#FF4500] border-[#FF4500]/20">
                          {log.tool_name}
                        </Badge>
                      </td>
                      <td className="py-3 text-sm text-zinc-400 max-w-xs truncate">
                        {JSON.stringify(log.arguments).substring(0, 80)}...
                      </td>
                      <td className="py-3 text-sm text-zinc-400 max-w-xs truncate">
                        {JSON.stringify(log.result).substring(0, 80)}...
                      </td>
                      <td className="py-3 text-xs text-zinc-500 font-mono">
                        {log.session_id.substring(0, 8)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ScrollArea>
        </Card>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const [config, setConfig] = useState({
    assistantName: 'Mind',
    userName: '',
    notifications: true,
    autoSave: true
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const res = await fetch(`${API}/settings/config`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setConfig({ ...config, ...data.config });
      }
    } catch (e) {
      console.error('Failed to load config:', e);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/settings/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(config)
      });
      if (res.ok) {
        toast.success('Settings saved');
      } else {
        throw new Error('Failed to save');
      }
    } catch (e) {
      console.error('Failed to save config:', e);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
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
                Back
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <h1 className="heading text-xl font-semibold flex items-center gap-2">
                <SettingsIcon className="w-5 h-5 text-[#FF4500]" />
                Settings
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 py-6">
        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="bg-[#141416] border border-[#1f2022]">
            <TabsTrigger value="general" className="data-[state=active]:bg-[#FF4500]">
              <User className="w-4 h-4 mr-2" />
              General
            </TabsTrigger>
            <TabsTrigger value="notifications" className="data-[state=active]:bg-[#FF4500]">
              <Bell className="w-4 h-4 mr-2" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="audit" className="data-[state=active]:bg-[#FF4500]">
              <History className="w-4 h-4 mr-2" />
              Audit Log
            </TabsTrigger>
          </TabsList>

          {/* General Tab */}
          <TabsContent value="general">
            <Card className="border-[#1f2022] bg-[#141416]/95">
              <CardHeader>
                <CardTitle className="text-zinc-100">General Settings</CardTitle>
                <CardDescription className="text-zinc-400">
                  Manage your account and preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-zinc-300">Assistant Name</Label>
                  <Input
                    value={config.assistantName}
                    onChange={(e) => setConfig({ ...config, assistantName: e.target.value })}
                    className="bg-[#0f0f10] border-[#1f2022] text-zinc-100"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-zinc-300">Your Name</Label>
                  <Input
                    value={config.userName}
                    onChange={(e) => setConfig({ ...config, userName: e.target.value })}
                    className="bg-[#0f0f10] border-[#1f2022] text-zinc-100"
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg bg-[#0f0f10] border border-[#1f2022]">
                  <div>
                    <Label className="text-zinc-300">Auto-save</Label>
                    <p className="text-xs text-zinc-500">Automatically save changes</p>
                  </div>
                  <Switch
                    checked={config.autoSave}
                    onCheckedChange={(checked) => setConfig({ ...config, autoSave: checked })}
                  />
                </div>

                <Button
                  onClick={saveConfig}
                  disabled={saving}
                  className="bg-[#FF4500] hover:bg-[#E63E00]"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <FileText className="w-4 h-4 mr-2" />
                  )}
                  Save Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications">
            <Card className="border-[#1f2022] bg-[#141416]/95">
              <CardHeader>
                <CardTitle className="text-zinc-100">Notification Preferences</CardTitle>
                <CardDescription className="text-zinc-400">
                  Choose what notifications you want to receive
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-[#0f0f10] border border-[#1f2022]">
                  <div>
                    <Label className="text-zinc-300">Desktop Notifications</Label>
                    <p className="text-xs text-zinc-500">Show browser notifications</p>
                  </div>
                  <Switch
                    checked={config.notifications}
                    onCheckedChange={(checked) => setConfig({ ...config, notifications: checked })}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audit Log Tab */}
          <TabsContent value="audit">
            <AuditLogTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
