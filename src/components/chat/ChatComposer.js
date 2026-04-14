'use client';

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
  selectedImage,
  onRemoveSelectedImage,
  textareaRef,
  fileInputRef,
  onImageChange,
}) {
  return (
    <div className="input-area">
      <div className="feature-row">
        <button className="feature-toggle" type="button" onClick={onSummary}>
          📄 Summary
        </button>
        <button className="feature-toggle" type="button" onClick={onPractice} disabled={isLoading || imageLoading}>
          📊 Practice
        </button>
        <button className="feature-toggle" type="button" onClick={onRegenerate} disabled={isLoading || imageLoading}>
          🔄 Regenerate
        </button>
        <button
          className={`feature-toggle ${responseMode === 'deep' ? 'active' : ''}`}
          type="button"
          onClick={onDeepToggle}
          disabled={isLoading || imageLoading}
        >
          🧠 Deep Mode
        </button>
      </div>

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
          placeholder="Message Arithmo AI..."
          rows={1}
        />

        <button
          className="icon-action-btn"
          onClick={onAttachClick}
          disabled={isLoading || imageLoading}
          title="Attach image"
          aria-label="Attach image"
          type="button"
        >
          📎
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          hidden
          onChange={onImageChange}
        />

        <button
          className="icon-action-btn"
          onClick={onGenerateImage}
          disabled={!input.trim() || isLoading || imageLoading}
          title="Generate image"
          aria-label="Generate image"
          type="button"
        >
          {imageLoading ? '⏳' : '🖼'}
        </button>

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
          {isListening ? '◉' : '🎤'}
        </button>

        {isLoading ? (
          <button className="send-btn stop" onClick={onSend} type="button">
            ■
          </button>
        ) : (
          <button className="send-btn" onClick={onSend} disabled={!input.trim() && !selectedImage} type="button">
            ➤
          </button>
        )}
      </div>

      <p className="input-disclaimer">
        Arithmo AI may produce incorrect information. <a href="/terms">Terms</a> | <a href="/privacy">Privacy</a>
      </p>
    </div>
  );
}
