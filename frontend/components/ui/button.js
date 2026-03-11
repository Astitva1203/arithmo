import { cn } from "../../utils/cn";

export function Button({ className, variant = "default", ...props }) {
  const base =
    "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2";
  const variants = {
    default:
      "border border-white/30 bg-gradient-to-r from-cyan-500 to-violet-500 text-white shadow hover:brightness-110",
    ghost: "bg-transparent hover:bg-white/20 dark:hover:bg-slate-700/40",
    danger: "bg-rose-600 text-white hover:bg-rose-500"
  };

  return <button className={cn(base, variants[variant], className)} {...props} />;
}
