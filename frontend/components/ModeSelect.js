import { MODES } from "../hooks/useChatStore";

export function ModeSelect({ mode, onChange }) {
  return (
    <select
      value={mode}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-xl border border-white/35 bg-white/30 px-3 py-2 text-sm backdrop-blur-xl outline-none transition hover:bg-white/45 focus:ring-2 focus:ring-cyan-400/70 dark:border-slate-500/40 dark:bg-slate-900/35 dark:hover:bg-slate-800/55"
    >
      {MODES.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
