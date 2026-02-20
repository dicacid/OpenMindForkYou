import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Command } from 'cmdk';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Search,
  Home,
  Brain,
  Package,
  Clock,
  Settings,
  MessageSquare,
  Zap,
  ArrowRight
} from 'lucide-react';

const commands = [
  { id: 'home', label: 'Go to Setup', icon: Home, action: '/' },
  { id: 'memory', label: 'Open Memory Manager', icon: Brain, action: '/memory' },
  { id: 'skills', label: 'Browse Skills', icon: Package, action: '/skills' },
  { id: 'scheduler', label: 'Open Scheduler', icon: Clock, action: '/scheduler' },
  { id: 'chat', label: 'Start Chat', icon: MessageSquare, action: '/chat' },
  { id: 'settings', label: 'Open Settings', icon: Settings, action: '/settings' },
];

export default function CommandPalette({ open, onOpenChange }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  useEffect(() => {
    const down = (e) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(true);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [onOpenChange]);

  const handleSelect = (action) => {
    navigate(action);
    onOpenChange(false);
    setSearch('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#141416] border-[#1f2022] p-0 overflow-hidden max-w-2xl">
        <Command className="bg-transparent">
          <div className="flex items-center border-b border-[#1f2022] px-3">
            <Search className="w-5 h-5 text-zinc-500 mr-2" />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Type a command or search..."
              className="w-full py-4 bg-transparent text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
            />
          </div>
          <Command.List className="max-h-[400px] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-zinc-500">
              No results found.
            </Command.Empty>
            <Command.Group heading="Pages" className="text-xs text-zinc-500 px-2 pb-1">
              {commands.map((cmd) => {
                const Icon = cmd.icon;
                return (
                  <Command.Item
                    key={cmd.id}
                    onSelect={() => handleSelect(cmd.action)}
                    className="flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer hover:bg-[#1f2022] text-zinc-300 data-[selected=true]:bg-[#1f2022]"
                  >
                    <Icon className="w-4 h-4" />
                    <span>{cmd.label}</span>
                    <ArrowRight className="w-4 h-4 ml-auto text-zinc-600" />
                  </Command.Item>
                );
              })}
            </Command.Group>
          </Command.List>
          <div className="border-t border-[#1f2022] px-3 py-2 text-xs text-zinc-500">
            <kbd className="px-2 py-1 rounded bg-[#1f2022] text-zinc-400">⌘K</kbd> or{' '}
            <kbd className="px-2 py-1 rounded bg-[#1f2022] text-zinc-400">Ctrl+K</kbd> to open
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
