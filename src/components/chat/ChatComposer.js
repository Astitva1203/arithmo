'use client';

import { useEffect, useState } from 'react';
import {
  Mic,
  MicOff,
  MoreHorizontal,
  Paperclip,
  SendHorizontal,
  Square,
  X,
} from 'lucide-react';

export default function ChatComposer({
  input,
  onInputChange,
  onKeyDown,
  onSend,
  onAttachClick,
  onGenerateImage,
  onPractice,
  onSummary,
  onRegenerate,
  onDeepToggle,
  onMic,
  isListening,
  micAvailable,
  isLoading,
  imageLoading,
  responseMode,
  deviceType,
  selectedImage,
  onRemoveSelectedImage,
  textareaRef,
  fileInputRef,
  onImageChange,
}) {
  const isMobile = deviceType === 'mobile';
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);

  useEffect(() => {
    if (!isMobile) {
      setMobileToolsOpen(false);
    }
  }, [isMobile]);

  return (
    <div className="input-area">
      <div className={`feature-row ${isMobile ? 'mobile-primary-actions' : ''}`}>
        <button className="feature-toggle" type="button" onClick={onSummary} title="Summary" aria-label="Summary">
          <span>📄 Summary</span>
        </button>
        <button
          className="feature-toggle"
          type="button"
          onClick={onRegenerate}
          disabled={isLoading || imageLoading}
          title="Regenerate"
          aria-label="Regenerate"
        >
          <span>🔄 Regenerate</span>
        </button>
        <button
          className={`feature-toggle ${responseMode === 'deep' ? 'active' : ''}`}
          type="button"
          onClick={onDeepToggle}
          disabled={isLoading || imageLoading}
          title="Deep Think"
          aria-label="Deep Think"
        >
          <span>🧠 Deep Think</span>
        </button>
        {!isMobile && (
          <button
            className="feature-toggle"
            type="button"
            onClick={onPractice}
            disabled={isLoading || imageLoading}
            title="Practice"
            aria-label="Practice"
          >
            <span>📊 Practice</span>
          </button>
        )}
        {isMobile && (
          <button
            className={`feature-toggle ${mobileToolsOpen ? 'active' : ''}`}
            type="button"
            onClick={() => setMobileToolsOpen((value) => !value)}
            disabled={isLoading || imageLoading}
            aria-expanded={mobileToolsOpen}
          >
            {mobileToolsOpen ? <X size={14} /> : <MoreHorizontal size={14} />}
            <span>{mobileToolsOpen ? 'Close' : 'Tools'}</span>
          </button>
        )}
      </div>

      {isMobile && mobileToolsOpen && (
        <div className="mobile-tools-row">
          <button
            className="feature-toggle compact"
            type="button"
            onClick={onPractice}
            disabled={isLoading || imageLoading}
            title="Practice"
            aria-label="Practice"
          >
            <span>📊 Practice</span>
          </button>
          <button
            className="icon-action-btn compact"
            onClick={onAttachClick}
            disabled={isLoading || imageLoading}
            title="Attach image"
            aria-label="Attach image"
            type="button"
          >
            <Paperclip size={16} />
          </button>
          <button
            className="icon-action-btn compact"
            onClick={onGenerateImage}
            disabled={!input.trim() || isLoading || imageLoading}
            title="Generate image"
            aria-label="Generate image"
            type="button"
          >
            {imageLoading ? '...' : '🖼️'}
          </button>
          <button
            className="feature-toggle compact"
            type="button"
            onClick={() => setMobileToolsOpen(false)}
            disabled={isLoading || imageLoading}
          >
            <X size={14} />
            <span>Done</span>
          </button>
        </div>
      )}

      {selectedImage && (
        <div className="image-chip">
          <img src={selectedImage.dataUrl} alt={selectedImage.name || 'Attached image'} />
          <div className="image-chip-meta">
            <strong>{selectedImage.name}</strong>
            <span>Attached for analysis</span>
          </div>
          <button className="image-remove-btn" onClick={onRemoveSelectedImage} type="button">
            Remove
          </button>
        </div>
      )}

      <div className="input-row liquid-input-row">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={isMobile ? 'Type your message...' : 'Message Arithmo AI...'}
          rows={1}
        />

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          hidden
          onChange={onImageChange}
        />

        {!isMobile && (
          <>
            <button
              className="icon-action-btn"
              onClick={onAttachClick}
              disabled={isLoading || imageLoading}
              title="Attach image"
              aria-label="Attach image"
              type="button"
            >
              <Paperclip size={16} />
            </button>

            <button
              className="icon-action-btn"
              onClick={onGenerateImage}
              disabled={!input.trim() || isLoading || imageLoading}
              title="Generate image"
              aria-label="Generate image"
              type="button"
            >
              {imageLoading ? '...' : '🖼️'}
            </button>
          </>
        )}

        <button
          className={`icon-action-btn mic-btn ${isListening ? 'mic-active' : ''}`}
          type="button"
          onClick={onMic}
          title={
            !micAvailable
              ? 'Voice input not supported in this browser'
              : isListening
                ? 'Stop voice input'
                : 'Start voice input'
          }
          aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
          disabled={!micAvailable || isLoading || imageLoading}
        >
          {isListening ? <MicOff size={16} /> : <Mic size={16} />}
        </button>

        {isLoading ? (
          <button className="send-btn stop" onClick={onSend} type="button">
            <Square size={14} fill="currentColor" />
          </button>
        ) : (
          <button className="send-btn" onClick={onSend} disabled={!input.trim() && !selectedImage} type="button">
            <SendHorizontal size={16} />
          </button>
        )}
      </div>

      <p className="input-disclaimer">
        Arithmo AI may produce incorrect information. <a href="/terms">Terms</a> | <a href="/privacy">Privacy</a>
      </p>
    </div>
  );
}
