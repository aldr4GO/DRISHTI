'use client';

import { useState, useRef, useEffect } from 'react';
import { ChatMessage, BoundingBox } from '@/types/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatbotPanelProps {
  messages: ChatMessage[];
  onSendMessage: (message: string, queryType: 'chat' | 'localisation' | 'region') => void;
  isProcessing: boolean;
  boundingBoxes: BoundingBox[];
  selectedObjectId: string | null;
  onObjectSelect: (objectId: string | null) => void;
  onObjectRename?: (objectId: string, newName: string) => void;
  isRegionSelectMode?: boolean;
  onRegionSelectModeChange?: (enabled: boolean) => void;
  hasRegionSelected?: boolean;
  onClearOverlays?: () => void;
  onClose?: () => void;
}

export default function ChatbotPanel({ messages, onSendMessage, isProcessing, boundingBoxes, selectedObjectId, onObjectSelect, onObjectRename, isRegionSelectMode, onRegionSelectModeChange, hasRegionSelected, onClearOverlays, onClose }: ChatbotPanelProps) {
  const [inputValue, setInputValue] = useState('');
  const [selectedQueryType, setSelectedQueryType] = useState<'chat' | 'localisation' | 'region'>('chat');
  const [editingObjectId, setEditingObjectId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  useEffect(() => {
    if (editingObjectId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingObjectId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onSendMessage(inputValue, selectedQueryType);
      setInputValue('');
    }
  };
  
  const handleStartEdit = (e: React.MouseEvent, objectId: string, currentName: string) => {
    e.stopPropagation();
    setEditingObjectId(objectId);
    setEditingName(currentName);
  };
  
  const handleSaveEdit = (objectId: string) => {
    if (editingName.trim() && onObjectRename) {
      onObjectRename(objectId, editingName.trim());
    }
    setEditingObjectId(null);
    setEditingName('');
  };
  
  const handleCancelEdit = () => {
    setEditingObjectId(null);
    setEditingName('');
  };
  
  const handleEditKeyDown = (e: React.KeyboardEvent, objectId: string) => {
    if (e.key === 'Enter') {
      handleSaveEdit(objectId);
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const queryTypes = [
    { value: 'chat', label: 'Chat', color: 'teal' },
    { value: 'localisation', label: 'Localisation', color: 'purple' },
    { value: 'region', label: 'Region Query', color: 'amber' },
  ] as const;
  
  // Handle query type change - enable region select mode when Region Query is selected
  // Also clear overlays when switching away from localization
  const handleQueryTypeChange = (type: 'chat' | 'localisation' | 'region') => {
    const previousType = selectedQueryType;
    setSelectedQueryType(type);
    
    // Clear overlays when switching from localization to chat or region
    if (previousType === 'localisation' && type !== 'localisation' && onClearOverlays) {
      onClearOverlays();
    }
    
    if (type === 'region' && onRegionSelectModeChange) {
      onRegionSelectModeChange(true);
    } else if (onRegionSelectModeChange) {
      onRegionSelectModeChange(false);
    }
  };
  
  // Pastel color palette matching ImagePanel
  const pastelColors = [
    '#3b82f6',  // blue
    '#10b981',  // green
    '#d97706',  // amber
    '#db2777',  // pink
    '#7c3aed',  // violet
    '#0891b2',  // cyan
    '#ea580c',  // orange
    '#0d9488',  // teal
    '#9333ea',  // purple
    '#dc2626',  // red
  ];
  
  const getObjectColor = (index: number) => {
    return pastelColors[index % pastelColors.length];
  };

  return (
    <div className="w-full xl:w-[420px] h-screen modern-panel flex flex-col overflow-hidden border-l border-border-subtle" style={{ borderRadius: 0 }}>
      {/* Header */}
      <div className="px-5 py-4 border-b border-border-subtle">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold text-text-primary">AI Assistant</h2>
          <div className="flex items-center gap-2">
            <div className="status-badge status-badge-teal text-xs">
              <div className="pulse-indicator"></div>
              Active
            </div>
            {/* Close button for mobile/tablet */}
            {onClose && (
              <button
                onClick={onClose}
                className="xl:hidden p-2 hover:bg-elevated-bg rounded-lg transition-colors"
                aria-label="Close chatbot"
              >
                <svg className="w-5 h-5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
        <p className="text-xs text-text-muted">Powered by DRISHTI</p>
      </div>

      {/* Query Type Selector - 3 Buttons */}
      <div className="px-5 py-3 border-b border-border-subtle bg-elevated-bg">
        <div className="grid grid-cols-3 gap-2">
          {queryTypes.map((type) => (
            <button
              key={type.value}
              onClick={() => handleQueryTypeChange(type.value)}
              className={`px-3 py-2 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-2 ${
                selectedQueryType === type.value
                  ? type.color === 'teal'
                    ? 'bg-glow-teal border border-accent-teal/30 text-accent-teal'
                    : type.color === 'purple'
                    ? 'bg-glow-purple border border-accent-purple/30 text-accent-purple'
                    : 'bg-amber-500/20 border border-amber-500/30 text-amber-400'
                  : 'border border-border-medium text-text-secondary hover:border-border-medium hover:bg-elevated-bg'
              }`}
            >
              <span>{type.label}</span>
            </button>
          ))}
        </div>
        {/* Region Query Instructions */}
        {selectedQueryType === 'region' && (
          <div className="mt-3 p-3 rounded-md bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
              <span className="text-xs font-semibold text-amber-400">Region Selection Mode</span>
            </div>
            <p className="text-xs text-text-muted mb-2">
              {hasRegionSelected 
                ? '✓ Region selected! Type your question about this area.'
                : 'Draw a rectangle on the image to select a region, then ask your question.'}
            </p>
            {hasRegionSelected && (
              <div className="flex items-center gap-1 text-xs text-green-400">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>Ready to query</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Detected Objects List */}
      {boundingBoxes.length > 0 && (
        <div className="px-5 py-3 border-b border-border-subtle bg-panel-bg">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-accent-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <p className="text-xs font-semibold text-text-primary uppercase tracking-wide">Detected Objects ({boundingBoxes.length})</p>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {boundingBoxes.map((box, index) => {
              const objectColor = getObjectColor(index);
              return (
              <div
                key={box.object_id}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md transition-all ${
                  selectedObjectId === box.object_id
                    ? 'bg-accent-purple/20 border border-accent-purple'
                    : 'bg-elevated-bg border border-border-medium hover:border-accent-purple hover:bg-glow-purple'
                }`}
              >
                <button
                  onClick={() => onObjectSelect(selectedObjectId === box.object_id ? null : box.object_id)}
                  className="flex items-center gap-2 text-xs text-text-secondary flex-1 min-w-0"
                >
                  <div 
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      selectedObjectId === box.object_id ? 'animate-pulse' : ''
                    }`}
                    style={{ backgroundColor: selectedObjectId === box.object_id ? '#a855f7' : objectColor }}
                  ></div>
                  {editingObjectId === box.object_id ? (
                    <input
                      ref={editInputRef}
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => handleEditKeyDown(e, box.object_id)}
                      onBlur={() => handleSaveEdit(box.object_id)}
                      onClick={(e) => e.stopPropagation()}
                      className="bg-dark-bg border border-accent-purple rounded px-2 py-0.5 text-xs font-medium text-text-primary flex-1 min-w-0 focus:outline-none focus:ring-1 focus:ring-accent-purple"
                    />
                  ) : (
                    <span className={`font-medium truncate ${
                      selectedObjectId === box.object_id ? 'text-accent-purple' : ''
                    }`}>{box.object_id}</span>
                  )}
                </button>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {editingObjectId !== box.object_id && (
                    <button
                      onClick={(e) => handleStartEdit(e, box.object_id, box.object_id)}
                      className="p-1 rounded hover:bg-elevated-bg transition-colors"
                      title="Rename object"
                    >
                      <svg className="w-3.5 h-3.5 text-text-dim hover:text-accent-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  )}
                  {box.confidence && (
                    <span className={`text-xs font-semibold ${
                      selectedObjectId === box.object_id ? 'text-accent-purple' : 'text-accent-purple'
                    }`}>
                      {(box.confidence * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>
            );
            })}
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center space-y-4 max-w-xs">
              <div className="w-16 h-16 mx-auto rounded-full bg-elevated-bg flex items-center justify-center">
                <svg className="w-8 h-8 text-text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary mb-1">No messages yet</p>
                <p className="text-xs text-text-muted">Upload an image to start analyzing</p>
              </div>
              
              {/* Quick Actions */}
              <div className="space-y-2 pt-2">
                <p className="section-label text-left">SUGGESTED QUERIES</p>
                <button className="w-full text-left px-3 py-2 rounded-md border border-border-medium hover:border-accent-teal hover:bg-glow-teal transition-all text-xs text-text-secondary hover:text-accent-teal">
                  Describe the image in detail.
                </button>
                <button className="w-full text-left px-3 py-2 rounded-md border border-border-medium hover:border-accent-purple hover:bg-glow-purple transition-all text-xs text-text-secondary hover:text-accent-purple">
                  Given image is urban area or rural.
                </button>
                <button className="w-full text-left px-3 py-2 rounded-md border border-border-medium hover:border-accent-teal hover:bg-glow-teal transition-all text-xs text-text-secondary hover:text-accent-teal">
                  Analyze terrain features in the image.
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`fade-in ${message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-elevated-bg border border-border-medium text-text-primary'
                      : 'bg-panel-bg border border-border-subtle text-text-secondary'
                  }`}
                >
                  {message.queryType && message.role === 'user' && (
                    <div className="flex items-center gap-1.5 mb-2">
                      <div className={`status-badge ${
                        message.queryType === 'chat' ? 'status-badge-teal' : 'status-badge-purple'
                      }`}>
                        <span className="text-xs">
                          {message.queryType === 'chat' ? 'Chat' : 'Localisation'}
                        </span>
                      </div>
                    </div>
                  )}
                  <div className="prose prose-sm prose-invert max-w-none">
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({node, ...props}) => <p className="text-sm leading-relaxed mb-2 last:mb-0" {...props} />,
                        h1: ({node, ...props}) => <h1 className="text-base font-bold mb-2 mt-3 first:mt-0" {...props} />,
                        h2: ({node, ...props}) => <h2 className="text-sm font-bold mb-1 mt-2 first:mt-0" {...props} />,
                        h3: ({node, ...props}) => <h3 className="text-sm font-semibold mb-1 mt-2 first:mt-0" {...props} />,
                        ul: ({node, ...props}) => <ul className="list-disc list-inside text-sm mb-2 space-y-0.5" {...props} />,
                        ol: ({node, ...props}) => <ol className="list-decimal list-inside text-sm mb-2 space-y-0.5" {...props} />,
                        li: ({node, ...props}) => <li className="text-sm" {...props} />,
                        strong: ({node, ...props}) => <strong className="font-semibold" {...props} />,
                        em: ({node, ...props}) => <em className="italic" {...props} />,
                        code: ({node, ...props}: any) => 
                          props.inline 
                            ? <code className="px-1 py-0.5 bg-elevated-bg rounded text-xs font-mono" {...props} />
                            : <code className="block px-2 py-1 bg-elevated-bg rounded text-xs font-mono overflow-x-auto mb-2" {...props} />,
                        blockquote: ({node, ...props}) => <blockquote className="border-l-2 border-accent-teal pl-3 italic text-sm mb-2" {...props} />,
                        a: ({node, ...props}) => <a className="text-accent-teal hover:underline" {...props} />,
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                  <p className="text-xs text-text-dim mt-2">
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
            
            {isProcessing && (
              <div className="flex justify-start fade-in">
                <div className="bg-panel-bg border border-border-subtle rounded-lg px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex space-x-1.5">
                      <div className="w-2 h-2 rounded-full bg-accent-teal animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 rounded-full bg-accent-teal animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 rounded-full bg-accent-teal animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                    <span className="text-xs text-text-muted">Processing...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <div className="px-5 py-4 border-t border-border-subtle">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask a question about the image..."
              className="w-full input-field pr-12 text-sm"
            />
            <button
              type="submit"
              disabled={!inputValue.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-md bg-accent-teal hover:bg-accent-teal/90 text-pure-black flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:bg-accent-teal"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
          
          <div className="flex items-center justify-end text-xs">
            <span className="text-text-dim">
              {selectedQueryType === 'chat' ? 'Chat mode' : selectedQueryType === 'localisation' ? 'Localisation mode' : 'Region query mode'}
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}
