import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import toast from "react-hot-toast";
import { AuthCard } from "../components/AuthCard";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { api } from "../utils/api";
import { useAuthStore } from "../hooks/useAuthStore";

export default function SignUp() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    acceptTerms: false,
    acceptPrivacy: false,
    ageConfirmed: false,
    policyVersion: "2026-03-11"
  });
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/signup", form);
      login(data);
      toast.success("Account created");
      router.push("/dashboard");
    } catch (error) {
      toast.error(error.response?.data?.message || "Sign up failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title="Create Arithmo account"
      subtitle="Start building with AI"
      altHref="/signin"
      altText="Already a member?"
      altLabel="Sign in"
    >
      <form onSubmit={submit} className="space-y-3">
        <Input required placeholder="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        <Input type="email" required placeholder="Email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
        <Input type="password" minLength={8} required placeholder="Password (min 8 chars)" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
        <label className="flex items-start gap-2 text-xs">
          <input
            type="checkbox"
            checked={form.acceptTerms}
            onChange={(e) => setForm((f) => ({ ...f, acceptTerms: e.target.checked }))}
            required
            className="mt-0.5"
          />
          <span>
            I agree to the <Link href="/terms" className="underline">Terms & Conditions</Link>.
          </span>
        </label>
        <label className="flex items-start gap-2 text-xs">
          <input
            type="checkbox"
            checked={form.acceptPrivacy}
            onChange={(e) => setForm((f) => ({ ...f, acceptPrivacy: e.target.checked }))}
            required
            className="mt-0.5"
          />
          <span>
            I agree to the <Link href="/privacy" className="underline">Privacy Policy</Link>.
          </span>
        </label>
        <label className="flex items-start gap-2 text-xs">
          <input
            type="checkbox"
            checked={form.ageConfirmed}
            onChange={(e) => setForm((f) => ({ ...f, ageConfirmed: e.target.checked }))}
            required
            className="mt-0.5"
          />
          <span>I confirm I meet the minimum age requirement in my region.</span>
        </label>
        <Button disabled={loading} className="w-full">{loading ? "Creating..." : "Sign Up"}</Button>
      </form>
    </AuthCard>
  );
}
