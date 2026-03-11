import { Moon, Sun } from "lucide-react";

export function ThemeToggle({ dark, onToggle }) {
  return (
    <button onClick={onToggle} className="glass rounded-xl p-2" title="Toggle theme">
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
