import { useMemo } from "react";
import { motion } from "framer-motion";

export function OnboardingTour({ open, step, onNext, onClose, targets }) {
  const steps = useMemo(
    () => [
      { key: "input", title: "Chat Input", text: "Type your question here and press Enter to send." },
      { key: "voice", title: "Voice Command", text: "Use this mic button to speak your prompt." },
      { key: "file", title: "File Upload", text: "Upload PDF, TXT, or DOCX files for analysis." },
      { key: "templates", title: "Prompt Templates", text: "Use templates to quickly start useful prompts." }
    ],
    []
  );

  if (!open) return null;
  const current = steps[Math.min(step, steps.length - 1)];
  const target = targets?.[current.key];
  const rect = target?.getBoundingClientRect?.();
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1200;
  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 800;
  const cardWidth = 290;
  const cardHeight = 150;
  const gap = 14;
  const viewportPadding = 12;

  const preferredLeft = rect ? rect.left : viewportWidth / 2 - cardWidth / 2;
  const left = Math.max(viewportPadding, Math.min(preferredLeft, viewportWidth - cardWidth - viewportPadding));

  const canPlaceBelow = rect && rect.bottom + gap + cardHeight <= viewportHeight - viewportPadding;
  const top = rect
    ? canPlaceBelow
      ? rect.bottom + gap
      : Math.max(viewportPadding, rect.top - cardHeight - gap)
    : 140;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/35 backdrop-blur-[2px]">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="pointer-events-none absolute rounded-2xl border-2 border-cyan-400/70 shadow-[0_0_0_9999px_rgba(2,6,23,0.45)]"
        style={{
          top: rect ? rect.top - 6 : 100,
          left: rect ? rect.left - 6 : 100,
          width: rect ? rect.width + 12 : 320,
          height: rect ? rect.height + 12 : 80
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel absolute z-[101] w-[290px] rounded-2xl border border-white/30 p-4 text-sm"
        style={{ top, left }}
      >
        <h3 className="text-base font-semibold">{current.title}</h3>
        <p className="mt-1 text-sm opacity-85">{current.text}</p>
        <div className="mt-3 flex items-center justify-between">
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-xs hover:bg-white/20">
            Skip
          </button>
          <button onClick={onNext} className="rounded-lg bg-cyan-500 px-3 py-1 text-xs text-white">
            {step >= steps.length - 1 ? "Finish" : "Next"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
