import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, ChevronUp } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

export default function ActivityLog() {
  const [lastActivity, setLastActivity] = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    loadLastActivity();
    const interval = setInterval(loadLastActivity, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  const loadLastActivity = async () => {
    try {
      const res = await fetch(`${API}/activity/last`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setLastActivity(data.activity);
      }
    } catch (e) {
      console.error('Failed to load activity:', e);
    }
  };

  if (!lastActivity) return null;

  const timeAgo = (timestamp) => {
    const seconds = Math.floor((new Date() - new Date(timestamp)) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  return (
    <div className="border-t border-[#1f2022] bg-[#0f0f10]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#141416] transition-colors"
      >
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <Activity className="w-3.5 h-3.5 text-[#FF4500] animate-pulse" />
          <span className="truncate">
            {lastActivity.assistant_name || 'Mind'} ran{' '}
            <span className="text-[#FF4500] font-medium">{lastActivity.tool_name}</span>{' '}
            {timeAgo(lastActivity.timestamp)}
          </span>
        </div>
        <ChevronUp className={`w-4 h-4 transition-transform ${expanded ? '' : 'rotate-180'}`} />
      </button>
      
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 pb-3 text-xs text-zinc-500 overflow-hidden"
          >
            <div className="space-y-1">
              <div>Session: {lastActivity.session_id?.substring(0, 8)}</div>
              <div className="truncate">Args: {JSON.stringify(lastActivity.arguments).substring(0, 60)}...</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
