import { cn } from "../../utils/cn";

export function Input({ className, ...props }) {
  return (
    <input
      className={cn(
        "w-full rounded-xl border border-white/30 bg-white/30 px-3 py-2 text-sm outline-none ring-sky-400 placeholder:text-slate-500 backdrop-blur-xl focus:ring-2 dark:border-slate-500/50 dark:bg-slate-900/35 dark:placeholder:text-slate-300",
        className
      )}
      {...props}
    />
  );
}
