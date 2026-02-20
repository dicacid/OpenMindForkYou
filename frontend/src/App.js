import React, { useState, useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import LoginPage from "@/pages/LoginPage";
import SetupPage from "@/pages/SetupPage";
import AuthCallback from "@/pages/AuthCallback";
import MemoryManagerPage from "@/pages/MemoryManagerPage";
import SkillsPage from "@/pages/SkillsPage";
import HeartbeatSchedulerPage from "@/pages/HeartbeatSchedulerPage";
import ChatPage from "@/pages/ChatPage";
import SettingsPage from "@/pages/SettingsPage";
import CommandPalette from "@/components/CommandPalette";
import ActivityLog from "@/components/ActivityLog";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH

function AppRouter() {
  const location = useLocation();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    // Load theme from localStorage
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    document.documentElement.classList.toggle('light', savedTheme === 'light');
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('light', newTheme === 'light');
  };

  const showActivityLog = location.pathname !== '/login';
  
  // Check URL fragment (not query params) for session_id - MUST be synchronous
  // This runs BEFORE ProtectedRoute to prevent race conditions
  if (location.hash?.includes('session_id=')) {
    return <AuthCallback />;
  }
  
  return (
    <div className="min-h-screen">
      {/* Theme Toggle */}
      {location.pathname !== '/login' && (
        <div className="fixed top-4 right-4 z-50">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className="rounded-full w-10 h-10 p-0"
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5" />
            ) : (
              <Moon className="w-5 h-5" />
            )}
          </Button>
        </div>
      )}

      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<SetupPage />} />
        <Route path="/memory" element={<MemoryManagerPage />} />
        <Route path="/skills" element={<SkillsPage />} />
        <Route path="/scheduler" element={<HeartbeatSchedulerPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Activity Log */}
      {showActivityLog && (
        <div className="fixed bottom-0 left-0 right-0 z-40">
          <ActivityLog />
        </div>
      )}

      {/* Command Palette */}
      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
    </div>
  );
}

function App() {
  return (
    <div className="App dark">
      <Toaster data-testid="global-toaster" richColors position="top-center" />
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </div>
  );
}

export default App;
