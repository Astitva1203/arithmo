import { memo, useEffect, useRef } from "react";
import { ImagePlus, LoaderCircle, Mic, MicOff, Send, Upload } from "lucide-react";

export const ChatComposer = memo(function ChatComposer({
  value,
  onChange,
  onSend,
  loading,
  isListening,
  onMic,
  onStopMic,
  onFile,
  onImage,
  templates = [],
  onTemplateClick,
  inputRef,
  inputWrapperRef,
  micButtonRef,
  fileButtonRef,
  templateWrapRef
}) {
  const localRef = useRef(null);
  const textareaRef = inputRef || localRef;

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "0px";
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
  }, [value, textareaRef]);

  return (
    <div className="pb-1">
      {templates.length > 0 && (
        <div ref={templateWrapRef} className="mb-2 flex flex-wrap gap-2 px-1">
          {templates.map((template) => (
            <button
              key={template}
              type="button"
              onClick={() => onTemplateClick?.(template)}
              className="rounded-full border border-white/30 bg-white/25 px-3 py-1 text-xs backdrop-blur-xl transition hover:bg-white/40 dark:bg-slate-900/35 dark:hover:bg-slate-800/55"
            >
              {template}
            </button>
          ))}
        </div>
      )}

      <div className="glass-panel rounded-3xl border border-white/30 bg-gradient-to-r from-cyan-100/40 via-violet-100/35 to-pink-100/35 p-2 shadow-lg dark:from-cyan-900/20 dark:via-violet-900/20 dark:to-fuchsia-900/20">
        <div className="flex items-end gap-2">
          <button
            ref={micButtonRef}
            onClick={isListening ? onStopMic : onMic}
            className={`rounded-2xl p-2 transition ${
              isListening
                ? "bg-rose-500/90 text-white shadow"
                : "bg-white/40 hover:bg-white/60 dark:bg-slate-900/35 dark:hover:bg-slate-800/50"
            }`}
            title="Voice input"
          >
            {isListening ? <MicOff size={18} /> : <Mic size={18} />}
          </button>

          <label ref={fileButtonRef} className="cursor-pointer rounded-2xl bg-white/40 p-2 transition hover:bg-white/60 dark:bg-slate-900/35 dark:hover:bg-slate-800/50" title="Upload document">
            <Upload size={18} />
            <input type="file" accept=".txt,.pdf,.docx" className="hidden" onChange={onFile} />
          </label>

          <label className="cursor-pointer rounded-2xl bg-white/40 p-2 transition hover:bg-white/60 dark:bg-slate-900/35 dark:hover:bg-slate-800/50" title="Upload image">
            <ImagePlus size={18} />
            <input type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" className="hidden" onChange={onImage} />
          </label>

          <textarea
            data-onboard="input"
            ref={(el) => {
              textareaRef.current = el;
              if (inputWrapperRef) inputWrapperRef.current = el;
            }}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={1}
            placeholder="Message Arithmo..."
            className="max-h-[180px] min-h-[44px] w-full resize-none rounded-2xl border border-white/30 bg-white/35 px-4 py-3 text-sm outline-none placeholder:opacity-70 focus:ring-2 focus:ring-cyan-400/70 dark:border-slate-500/35 dark:bg-slate-900/45"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
          />

          <button
            onClick={onSend}
            disabled={loading}
            className="rounded-2xl bg-gradient-to-r from-cyan-500 to-violet-500 p-3 text-white shadow transition hover:brightness-110 disabled:opacity-60"
            title="Send"
          >
            {loading ? <LoaderCircle className="animate-spin" size={18} /> : <Send size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
});
