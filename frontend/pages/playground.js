import { useState } from "react";
import { useRouter } from "next/router";
import { javascript } from "@codemirror/lang-javascript";
import CodeMirror from "@uiw/react-codemirror";
import toast from "react-hot-toast";
import { Footer } from "../components/Footer";
import { Logo } from "../components/Logo";
import { Button } from "../components/ui/button";
import { api } from "../utils/api";

export default function Playground() {
  const router = useRouter();
  const [task, setTask] = useState("explain");
  const [language, setLanguage] = useState("javascript");
  const [code, setCode] = useState("function add(a, b) {\n  return a + b;\n}");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const runAssist = async () => {
    if (!code.trim()) return;
    try {
      setLoading(true);
      const { data } = await api.post("/ai/code-assist", { code, language, task });
      setResult(data.response || "");
    } catch {
      toast.error("Code assist failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen px-4 py-6">
      <div className="mx-auto max-w-6xl rounded-3xl p-6 glass">
        <div className="mb-4 flex items-center justify-between">
          <Logo compact />
          <Button variant="ghost" onClick={() => router.push("/dashboard")}>Back to Dashboard</Button>
        </div>

        <h1 className="mb-4 text-3xl font-bold">AI Code Playground</h1>
        <div className="mb-3 flex flex-wrap gap-2">
          <select value={language} onChange={(e) => setLanguage(e.target.value)} className="rounded-xl border border-white/40 bg-white/35 px-3 py-2 text-sm dark:border-slate-500/40 dark:bg-slate-900/35">
            <option value="javascript">JavaScript</option>
            <option value="typescript">TypeScript</option>
            <option value="python">Python</option>
            <option value="java">Java</option>
            <option value="cpp">C++</option>
          </select>
          <select value={task} onChange={(e) => setTask(e.target.value)} className="rounded-xl border border-white/40 bg-white/35 px-3 py-2 text-sm dark:border-slate-500/40 dark:bg-slate-900/35">
            <option value="explain">Explain</option>
            <option value="debug">Debug</option>
            <option value="optimize">Optimize</option>
          </select>
          <Button onClick={runAssist} disabled={loading}>{loading ? "Running..." : "Run Explanation"}</Button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/30 bg-slate-950/80">
          <CodeMirror value={code} height="320px" theme="dark" extensions={[javascript()]} onChange={setCode} />
        </div>

        <div className="mt-4 rounded-2xl border border-white/30 bg-white/25 p-4 dark:bg-slate-900/35">
          <h2 className="mb-2 font-semibold">AI Output</h2>
          <pre className="whitespace-pre-wrap text-sm">{result || "Run a task to see AI feedback."}</pre>
        </div>
      </div>
      <Footer />
    </main>
  );
}
