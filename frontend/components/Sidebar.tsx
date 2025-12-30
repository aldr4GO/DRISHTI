'use client';

import { useState, useRef, useEffect } from 'react';
import { Session } from '@/types/api';

interface SidebarProps {
  onImageUpload: (imageFile: File | string) => void;
  onNewSession: () => void;
  onSessionSelect: (sessionId: string) => void;
  onSessionRename: (sessionId: string, newName: string) => void;
  sessions: Session[];
  currentSessionId: string;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  gsd: number | null;
  onGsdChange: (gsd: number | null) => void;
  isSarMode: boolean;
  onSarModeChange: (enabled: boolean) => void;
  onClose?: () => void;
  hasActiveSession?: boolean;
}

export default function Sidebar({ 
  onImageUpload, 
  onNewSession, 
  onSessionSelect,
  onSessionRename,
  sessions,
  currentSessionId,
  darkMode,
  onToggleDarkMode,
  gsd,
  onGsdChange,
  isSarMode,
  onSarModeChange,
  onClose,
  hasActiveSession = false
}: SidebarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const [gsdInput, setGsdInput] = useState<string>('');

  // Reset file input when session changes
  useEffect(() => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [currentSessionId]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Create new session if current session is active (has an image)
      if (hasActiveSession) {
        onNewSession();
      }
      onImageUpload(file);
      // Reset the input so the same file can be uploaded again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      // Create new session if current session is active (has an image)
      if (hasActiveSession) {
        onNewSession();
      }
      onImageUpload(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const startRenaming = (sessionId: string, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(sessionId);
    setEditingName(currentName);
  };

  const handleRenameSubmit = (sessionId: string) => {
    if (editingName.trim()) {
      onSessionRename(sessionId, editingName.trim());
    }
    setEditingSessionId(null);
    setEditingName('');
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent, sessionId: string) => {
    if (e.key === 'Enter') {
      handleRenameSubmit(sessionId);
    } else if (e.key === 'Escape') {
      setEditingSessionId(null);
      setEditingName('');
    }
  };

  const handleGsdSubmit = () => {
    const value = parseFloat(gsdInput);
    if (!isNaN(value) && value > 0) {
      onGsdChange(value);
    }
  };
  
  const handleGsdClear = () => {
    onGsdChange(null);
    setGsdInput('');
  };

  return (
    <div className="h-screen w-full md:w-64 lg:w-64 modern-panel flex flex-col overflow-hidden border-r border-border-subtle" style={{ borderRadius: 0 }}>
      {/* Header */}
      <div className="px-4 py-4 border-b border-border-subtle">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent-teal flex items-center justify-center">
              <svg className="w-5 h-5 text-pure-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-text-primary">Vyoma Interface</h1>
              <p className="text-xs text-text-muted">Analysis Platform</p>
            </div>
          </div>
          {/* Close button for mobile */}
          {onClose && (
            <button
              onClick={onClose}
              className="md:hidden p-2 hover:bg-elevated-bg rounded-lg transition-colors"
              aria-label="Close sidebar"
            >
              <svg className="w-5 h-5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <button
          onClick={onNewSession}
          disabled={!hasActiveSession}
          className={`w-full btn-primary flex items-center justify-center gap-2 text-sm ${!hasActiveSession ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Session
        </button>
      </div>



      {/* GSD Input Section */}
      <div className="px-4 py-3 border-b border-border-subtle">
        <p className="section-label mb-3">GSD SETTINGS</p>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="0.01"
              min="0"
              value={gsdInput}
              onChange={(e) => setGsdInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleGsdSubmit()}
              placeholder="e.g., 0.5"
              className="flex-1 min-w-0 px-3 py-2 text-xs bg-dark-bg border border-border-medium rounded-lg text-text-primary placeholder-text-dim focus:outline-none focus:border-accent-teal transition-colors"
            />
            <button
              onClick={handleGsdSubmit}
              className="flex-shrink-0 px-3 py-2 text-xs bg-accent-teal text-pure-black rounded-lg hover:bg-accent-teal/80 transition-all font-medium whitespace-nowrap"
              title="Set GSD"
            >
              Set
            </button>
          </div>
          {gsd !== null ? (
            <div className="flex items-center justify-between bg-glow-teal border border-accent-teal/30 rounded-lg px-3 py-2">
              <span className="text-xs text-accent-teal font-semibold">
                Active: {gsd} m/px
              </span>
              <button
                onClick={handleGsdClear}
                className="text-xs text-red-400 hover:text-red-300 transition-colors"
                title="Clear GSD"
              >
                Clear
              </button>
            </div>
          ) : (
            <p className="text-xs text-text-dim text-center">
              Rulers will show pixels
            </p>
          )}
        </div>
      </div>

      {/* SAR Mode Toggle */}
      <div className="px-4 py-3 border-b border-border-subtle">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="text-xs font-medium text-text-primary">SAR Image Mode</span>
          </div>
          <button
            onClick={() => onSarModeChange(!isSarMode)}
            className={`relative w-10 h-5 rounded-full transition-colors ${
              isSarMode ? 'bg-accent-purple' : 'bg-border-medium'
            }`}
          >
            <div
              className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                isSarMode ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
        {isSarMode && (
          <p className="text-xs text-accent-purple mt-2">
            SAR mode enabled - upload SAR images
          </p>
        )}
      </div>

      {/* Upload Section */}
      <div className="px-4 py-4 border-b border-border-subtle">
        <p className="section-label mb-3">UPLOAD IMAGE</p>
        
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className="border-2 border-dashed border-border-medium rounded-lg p-4 text-center hover:border-accent-teal hover:bg-glow-teal transition-all cursor-pointer group"
          onClick={() => fileInputRef.current?.click()}
        >
          <svg className="w-10 h-10 mx-auto text-text-dim group-hover:text-accent-teal mb-2 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-xs text-text-muted group-hover:text-accent-teal transition-colors">Drop file or click to browse</p>
          <p className="text-xs text-text-dim mt-1">JPG, PNG, GIF up to 10MB</p>
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>

      {/* Session History */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        <p className="section-label px-3 mb-2">RECENT SESSIONS</p>
        
        <div className="space-y-1">
          {sessions.length === 0 ? (
            <p className="text-xs text-text-dim text-center py-8">No sessions yet</p>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className={`w-full px-3 py-2.5 rounded-md text-sm transition-all group ${
                  session.id === currentSessionId
                    ? 'bg-glow-teal border border-accent-teal/30 text-accent-teal'
                    : 'text-text-secondary hover:bg-elevated-bg hover:text-text-primary'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  {editingSessionId === session.id ? (
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={() => handleRenameSubmit(session.id)}
                      onKeyDown={(e) => handleRenameKeyDown(e, session.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 bg-elevated-bg border border-accent-teal rounded px-2 py-0.5 text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-teal"
                      autoFocus
                    />
                  ) : (
                    <button
                      onClick={() => onSessionSelect(session.id)}
                      className="flex-1 text-left font-medium truncate"
                    >
                      {session.name}
                    </button>
                  )}
                  <div className="flex items-center gap-1 ml-2">
                    {editingSessionId !== session.id && (
                      <button
                        onClick={(e) => startRenaming(session.id, session.name, e)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-elevated-bg rounded"
                        title="Rename session"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    )}
                    {session.id === currentSessionId && (
                      <div className="pulse-indicator"></div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => onSessionSelect(session.id)}
                  className="w-full text-left"
                >
                  <div className="text-xs text-text-dim flex items-center gap-1.5">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{session.timestamp.toLocaleDateString()}</span>
                    <span>•</span>
                    <span>{session.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border-subtle">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <div className="pulse-indicator"></div>
            <span className="text-accent-teal font-medium">Online</span>
          </div>
          <button
            onClick={onToggleDarkMode}
            className="btn-ghost p-1.5"
            title={darkMode ? 'Light Mode' : 'Dark Mode'}
          >
            {darkMode ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
