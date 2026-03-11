import { useEffect } from "react";
import { useState } from "react";
import { useRouter } from "next/router";
import toast from "react-hot-toast";
import { Footer } from "../components/Footer";
import { Logo } from "../components/Logo";
import { ThemeToggle } from "../components/ThemeToggle";
import { Button } from "../components/ui/button";
import { useAuthStore } from "../hooks/useAuthStore";
import { useTheme } from "../hooks/useTheme";
import { api } from "../utils/api";

export default function Settings() {
  const router = useRouter();
  const { dark, toggleTheme } = useTheme();
  const { logout, hydrate, user, updateUser } = useAuthStore();
  const [memories, setMemories] = useState([]);
  const [memoryForm, setMemoryForm] = useState({ memoryKey: "", memoryValue: "" });
  const [prefs, setPrefs] = useState({ responseStyle: "friendly", responseLength: "normal" });

  useEffect(() => {
    hydrate();
    if (!localStorage.getItem("arithmo_token")) router.replace("/signin");
  }, [hydrate, router]);

  const loadMemories = async () => {
    try {
      const { data } = await api.get("/memory");
      setMemories(data);
    } catch {
      toast.error("Could not load memories");
    }
  };

  useEffect(() => {
    if (localStorage.getItem("arithmo_token")) {
      loadMemories();
    }
  }, []);

  useEffect(() => {
    if (user) {
      setPrefs({
        responseStyle: user.responseStyle || "friendly",
        responseLength: user.responseLength || "normal"
      });
    }
  }, [user]);

  const clearChats = async () => {
    try {
      await api.delete("/chat/clear/all");
      toast.success("Chats cleared");
    } catch {
      toast.error("Could not clear chats");
    }
  };

  const deleteAccount = async () => {
    if (!confirm("Delete account and all chats permanently?")) return;
    try {
      await api.delete("/auth/me");
      logout();
      toast.success("Account deleted");
      router.push("/");
    } catch {
      toast.error("Delete account failed");
    }
  };

  const createMemory = async (e) => {
    e.preventDefault();
    if (!memoryForm.memoryKey.trim() || !memoryForm.memoryValue.trim()) return;
    try {
      await api.post("/memory", memoryForm);
      setMemoryForm({ memoryKey: "", memoryValue: "" });
      toast.success("Memory saved");
      await loadMemories();
    } catch {
      toast.error("Could not save memory");
    }
  };

  const updateMemory = async (memory) => {
    try {
      await api.put(`/memory/${memory._id}`, {
        memoryKey: memory.memoryKey,
        memoryValue: memory.memoryValue
      });
      toast.success("Memory updated");
      await loadMemories();
    } catch {
      toast.error("Could not update memory");
    }
  };

  const removeMemory = async (id) => {
    try {
      await api.delete(`/memory/${id}`);
      toast.success("Memory deleted");
      setMemories((prev) => prev.filter((item) => item._id !== id));
    } catch {
      toast.error("Could not delete memory");
    }
  };

  const savePreferences = async () => {
    try {
      const { data } = await api.patch("/auth/preferences", prefs);
      updateUser(data.user);
      toast.success("Preferences saved");
    } catch {
      toast.error("Could not save preferences");
    }
  };

  const reopenOnboarding = async () => {
    try {
      const { data } = await api.post("/auth/onboarding", { completed: false });
      updateUser(data.user);
      toast.success("Onboarding reset. Open dashboard to start guide.");
    } catch {
      toast.error("Could not reset onboarding");
    }
  };

  return (
    <main className="min-h-screen px-4 py-6">
      <div className="mx-auto max-w-3xl rounded-3xl p-6 glass">
        <div className="mb-6 flex items-center justify-between">
          <Logo compact />
          <Button variant="ghost" onClick={() => router.push("/dashboard")}>Back to Dashboard</Button>
        </div>

        <h1 className="mb-6 text-3xl font-bold">Settings</h1>

        <div className="space-y-4">
          <div className="glass rounded-2xl p-4">
            <h2 className="font-semibold">Theme</h2>
            <p className="mb-2 text-sm opacity-80">Switch between light and dark liquid glass themes.</p>
            <ThemeToggle dark={dark} onToggle={toggleTheme} />
          </div>

          <div className="glass rounded-2xl p-4">
            <h2 className="font-semibold">AI Response Settings</h2>
            <p className="mb-2 text-sm opacity-80">Control tone and length of AI responses.</p>
            <div className="grid gap-2 md:grid-cols-2">
              <select
                value={prefs.responseStyle}
                onChange={(e) => setPrefs((prev) => ({ ...prev, responseStyle: e.target.value }))}
                className="rounded-xl border border-white/40 bg-white/35 px-3 py-2 text-sm outline-none dark:border-slate-500/40 dark:bg-slate-900/35"
              >
                <option value="professional">Professional</option>
                <option value="friendly">Friendly</option>
                <option value="teacher">Teacher Mode</option>
                <option value="concise">Concise</option>
              </select>
              <select
                value={prefs.responseLength}
                onChange={(e) => setPrefs((prev) => ({ ...prev, responseLength: e.target.value }))}
                className="rounded-xl border border-white/40 bg-white/35 px-3 py-2 text-sm outline-none dark:border-slate-500/40 dark:bg-slate-900/35"
              >
                <option value="short">Short</option>
                <option value="normal">Normal</option>
                <option value="detailed">Detailed</option>
              </select>
            </div>
            <div className="mt-3 flex gap-2">
              <Button onClick={savePreferences}>Save Preferences</Button>
              <Button variant="ghost" onClick={reopenOnboarding}>Reopen Onboarding</Button>
            </div>
          </div>

          <div className="glass rounded-2xl p-4">
            <h2 className="font-semibold">Chat Data</h2>
            <p className="mb-2 text-sm opacity-80">Remove all conversation history from your account.</p>
            <Button onClick={clearChats} variant="danger">Clear Chats</Button>
          </div>

          <div className="glass rounded-2xl p-4">
            <h2 className="font-semibold">Memory Manager</h2>
            <p className="mb-3 text-sm opacity-80">Manage what Arithmo remembers about your preferences and instructions.</p>
            <form onSubmit={createMemory} className="mb-3 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
              <input
                placeholder="Memory key (e.g. learning_language)"
                value={memoryForm.memoryKey}
                onChange={(e) => setMemoryForm((prev) => ({ ...prev, memoryKey: e.target.value }))}
                className="rounded-xl border border-white/40 bg-white/35 px-3 py-2 text-sm outline-none dark:border-slate-500/40 dark:bg-slate-900/35"
              />
              <input
                placeholder="Memory value"
                value={memoryForm.memoryValue}
                onChange={(e) => setMemoryForm((prev) => ({ ...prev, memoryValue: e.target.value }))}
                className="rounded-xl border border-white/40 bg-white/35 px-3 py-2 text-sm outline-none dark:border-slate-500/40 dark:bg-slate-900/35"
              />
              <Button type="submit">Save</Button>
            </form>

            <div className="space-y-2">
              {memories.map((memory) => (
                <div key={memory._id} className="rounded-xl border border-white/30 bg-white/25 p-3 dark:border-slate-500/30 dark:bg-slate-900/30">
                  <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto_auto]">
                    <input
                      value={memory.memoryKey}
                      onChange={(e) =>
                        setMemories((prev) =>
                          prev.map((item) => (item._id === memory._id ? { ...item, memoryKey: e.target.value } : item))
                        )
                      }
                      className="rounded-lg border border-white/40 bg-white/35 px-2 py-1 text-sm outline-none dark:border-slate-500/40 dark:bg-slate-900/35"
                    />
                    <input
                      value={memory.memoryValue}
                      onChange={(e) =>
                        setMemories((prev) =>
                          prev.map((item) => (item._id === memory._id ? { ...item, memoryValue: e.target.value } : item))
                        )
                      }
                      className="rounded-lg border border-white/40 bg-white/35 px-2 py-1 text-sm outline-none dark:border-slate-500/40 dark:bg-slate-900/35"
                    />
                    <Button onClick={() => updateMemory(memory)}>Update</Button>
                    <Button variant="danger" onClick={() => removeMemory(memory._id)}>Delete</Button>
                  </div>
                </div>
              ))}
              {!memories.length && <p className="text-sm opacity-70">No memories saved yet.</p>}
            </div>
          </div>

          <div className="glass rounded-2xl p-4">
            <h2 className="font-semibold">Account</h2>
            <p className="mb-2 text-sm opacity-80">Permanently delete your profile and all associated data.</p>
            <Button onClick={deleteAccount} variant="danger">Delete Account</Button>
          </div>
        </div>
      </div>
      <Footer />
    </main>
  );
}
