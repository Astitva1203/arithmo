'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  ArrowUp,
  Square,
  X,
  Plus,
  Image as ImageIcon,
  BookOpen,
  MessageSquare,
  Search,
  Sparkles,
} from 'lucide-react';

export default function ChatComposer({
  input,
  onInputChange,
  onKeyDown,
  onSend,
  onAttachClick,
  onGenerateImage,
  chatMode,
  onChatModeChange,
  composerMode,
  onMic,
  isListening,
  micAvailable,
  isLoading,
  imageLoading,
  selectedImage,
  onRemoveSelectedImage,
  textareaRef,
  fileInputRef,
  onImageChange,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => {
    if (!menuOpen) return undefined;

    const closeOnOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', closeOnOutside);
    return () => document.removeEventListener('pointerdown', closeOnOutside);
  }, [menuOpen]);

  const selectChatMode = (mode) => {
    onChatModeChange?.(mode);
    setMenuOpen(false);
  };

  const selectImageMode = () => {
    onGenerateImage?.();
    setMenuOpen(false);
  };

  const attachImage = () => {
    onAttachClick?.();
    setMenuOpen(false);
  };

  return (
    <div className="floating-composer-area">
      {selectedImage && (
        <div className="image-chip">
          <img src={selectedImage.dataUrl} alt={selectedImage.name || 'Attached image'} />
          <div className="image-chip-meta">
            <strong>{selectedImage.name}</strong>
          </div>
          <button className="image-remove-btn" onClick={onRemoveSelectedImage} type="button" aria-label="Remove image">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="pill-composer">
        <div className="attachment-menu-anchor" ref={menuRef}>
          <button
            className={`pill-btn plus-btn ${menuOpen ? 'active' : ''}`}
            onClick={() => setMenuOpen((prev) => !prev)}
            type="button"
            aria-label="Open attachment menu"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
          >
            {menuOpen ? <X size={20} /> : <Plus size={20} />}
          </button>

          {menuOpen && (
            <div className="attachment-menu-popup" role="menu">
              <button
                className={`tool-popup-btn mode-btn ${chatMode === 'chat' && composerMode !== 'image' ? 'active' : ''}`}
                onClick={() => selectChatMode('chat')}
                disabled={isLoading || imageLoading}
                type="button"
                role="menuitem"
              >
                <MessageSquare size={18} /> <span>Chat Mode</span>
              </button>
              <button className="tool-popup-btn" onClick={attachImage} disabled={isLoading || imageLoading} type="button" role="menuitem">
                <ImageIcon size={18} /> <span>Attach Image</span>
              </button>
              <button
                className={`tool-popup-btn mode-btn ${chatMode === 'search' && composerMode !== 'image' ? 'active' : ''}`}
                onClick={() => selectChatMode('search')}
                disabled={isLoading || imageLoading}
                type="button"
                role="menuitem"
              >
                <Search size={18} /> <span>Search Mode</span>
              </button>
              <button
                className={`tool-popup-btn mode-btn ${chatMode === 'research' && composerMode !== 'image' ? 'active' : ''}`}
                onClick={() => selectChatMode('research')}
                disabled={isLoading || imageLoading}
                type="button"
                role="menuitem"
              >
                <BookOpen size={18} /> <span>Research Mode</span>
              </button>
              <button
                className={`tool-popup-btn mode-btn ${composerMode === 'image' ? 'active' : ''}`}
                onClick={selectImageMode}
                disabled={isLoading || imageLoading}
                type="button"
                role="menuitem"
              >
                <Sparkles size={18} /> <span>Create Image</span>
              </button>
            </div>
          )}
        </div>

        <textarea
          ref={textareaRef}
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={composerMode === 'image' ? 'Describe the image you want...' : 'Ask anything'}
          rows={1}
          maxLength={4000}
          className="pill-input"
        />

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          hidden
          onChange={onImageChange}
        />

        <button
          className={`pill-btn mic-btn ${isListening ? 'active' : ''}`}
          type="button"
          onClick={onMic}
          disabled={!micAvailable || isLoading || imageLoading}
          aria-label="Voice input"
        >
          {isListening ? <MicOff size={20} /> : <Mic size={20} />}
        </button>

        {isLoading ? (
          <button className="pill-btn send-btn stop active" onClick={onSend} type="button" aria-label="Stop response" title="Stop response">
            <Square size={14} fill="currentColor" />
          </button>
        ) : (
          <button className={`pill-btn send-btn ${input.trim() || selectedImage ? 'active' : ''}`} onClick={onSend} disabled={!input.trim() && !selectedImage} type="button" aria-label={composerMode === 'image' ? 'Create image' : 'Send message'}>
            <ArrowUp size={18} strokeWidth={2.5} />
          </button>
        )}
      </div>
    </div>
  );
}
