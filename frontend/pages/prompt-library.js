import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import toast from "react-hot-toast";
import { Footer } from "../components/Footer";
import { Logo } from "../components/Logo";
import { Button } from "../components/ui/button";
import { api } from "../utils/api";

export default function PromptLibrary() {
  const router = useRouter();
  const [prompts, setPrompts] = useState([]);
  const [form, setForm] = useState({ title: "", promptText: "" });

  const loadPrompts = async () => {
    try {
      const { data } = await api.get("/prompts");
      setPrompts(data);
    } catch {
      toast.error("Failed to load prompts");
    }
  };

  useEffect(() => {
    loadPrompts();
  }, []);

  const createPrompt = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.promptText.trim()) return;
    try {
      await api.post("/prompts", form);
      setForm({ title: "", promptText: "" });
      toast.success("Prompt created");
      loadPrompts();
    } catch {
      toast.error("Create failed");
    }
  };

  const updatePrompt = async (prompt) => {
    try {
      await api.put(`/prompts/${prompt._id}`, { title: prompt.title, promptText: prompt.promptText });
      toast.success("Prompt updated");
    } catch {
      toast.error("Update failed");
    }
  };

  const removePrompt = async (id) => {
    try {
      await api.delete(`/prompts/${id}`);
      setPrompts((prev) => prev.filter((p) => p._id !== id));
      toast.success("Prompt deleted");
    } catch {
      toast.error("Delete failed");
    }
  };

  return (
    <main className="min-h-screen px-4 py-6">
      <div className="mx-auto max-w-4xl rounded-3xl p-6 glass-panel border border-white/30">
        <div className="mb-6 flex items-center justify-between">
          <Logo compact />
          <Button variant="ghost" onClick={() => router.push("/dashboard")}>Back to Dashboard</Button>
        </div>
        <h1 className="mb-4 text-3xl font-bold">Prompt Library</h1>

        <form onSubmit={createPrompt} className="mb-4 grid gap-2">
          <input
            placeholder="Prompt title"
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            className="rounded-xl border border-white/30 bg-white/20 px-3 py-2 text-sm outline-none dark:bg-slate-900/35"
          />
          <textarea
            placeholder="Prompt text"
            value={form.promptText}
            onChange={(e) => setForm((prev) => ({ ...prev, promptText: e.target.value }))}
            className="min-h-24 rounded-xl border border-white/30 bg-white/20 px-3 py-2 text-sm outline-none dark:bg-slate-900/35"
          />
          <Button type="submit" className="w-fit">Create Prompt</Button>
        </form>

        <div className="space-y-2">
          {prompts.map((prompt) => (
            <div key={prompt._id} className="rounded-xl border border-white/30 bg-white/20 p-3 dark:bg-slate-900/35">
              <div className="grid gap-2">
                <input
                  value={prompt.title}
                  onChange={(e) =>
                    setPrompts((prev) => prev.map((p) => (p._id === prompt._id ? { ...p, title: e.target.value } : p)))
                  }
                  className="rounded-lg border border-white/25 bg-white/20 px-2 py-1 text-sm outline-none dark:bg-slate-900/35"
                />
                <textarea
                  value={prompt.promptText}
                  onChange={(e) =>
                    setPrompts((prev) => prev.map((p) => (p._id === prompt._id ? { ...p, promptText: e.target.value } : p)))
                  }
                  className="min-h-20 rounded-lg border border-white/25 bg-white/20 px-2 py-1 text-sm outline-none dark:bg-slate-900/35"
                />
                <div className="flex gap-2">
                  <Button onClick={() => updatePrompt(prompt)}>Save</Button>
                  <Button variant="danger" onClick={() => removePrompt(prompt._id)}>Delete</Button>
                </div>
              </div>
            </div>
          ))}
          {!prompts.length && <p className="text-sm opacity-70">No custom prompts yet.</p>}
        </div>
      </div>
      <Footer />
    </main>
  );
}
