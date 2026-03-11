import { useState } from "react";
import { useRouter } from "next/router";
import toast from "react-hot-toast";
import { AuthCard } from "../components/AuthCard";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { api } from "../utils/api";
import { useAuthStore } from "../hooks/useAuthStore";

export default function SignIn() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", form);
      login(data);
      toast.success("Welcome back");
      router.push("/dashboard");
    } catch (error) {
      toast.error(error.response?.data?.message || "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title="Sign in to Arithmo"
      subtitle="Continue your AI conversations"
      altHref="/signup"
      altText="New here?"
      altLabel="Create account"
    >
      <form onSubmit={submit} className="space-y-3">
        <Input type="email" required placeholder="Email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
        <Input type="password" required placeholder="Password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
        <Button disabled={loading} className="w-full">{loading ? "Signing in..." : "Sign In"}</Button>
      </form>
    </AuthCard>
  );
}
