import { useMemo } from "react";

export function StatusIndicator({ status }) {
  const meta = useMemo(() => {
    if (status === "online") return { label: "AI Online", color: "bg-emerald-500" };
    if (status === "slow") return { label: "AI Slow", color: "bg-amber-500" };
    return { label: "Service Unavailable", color: "bg-rose-500" };
  }, [status]);

  return (
    <div className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/20 px-3 py-1 text-xs backdrop-blur-xl dark:bg-slate-900/35">
      <span className={`h-2.5 w-2.5 rounded-full ${meta.color}`} />
      <span>{meta.label}</span>
    </div>
  );
}
