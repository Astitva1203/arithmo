import { motion } from "framer-motion";
import Link from "next/link";
import { Footer } from "../components/Footer";
import { Logo } from "../components/Logo";

export default function Home() {
  return (
    <main className="min-h-screen px-4 py-6">
      <div className="mx-auto flex min-h-[80vh] w-full max-w-6xl flex-col justify-center gap-6 rounded-3xl p-8 glass">
        <Logo />
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl font-bold md:text-6xl"
        >
          Arithmo: Your AI Partner for Chat, Code, Study, and Creativity
        </motion.h1>
        <p className="max-w-3xl text-lg opacity-85">
          A production-ready AI assistant powered by Groq, with voice commands, document summaries, secure authentication, and persistent chat history.
        </p>
        <div className="flex gap-3">
          <Link href="/signup" className="rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white dark:bg-cyan-400 dark:text-slate-900">
            Sign Up
          </Link>
          <Link href="/signin" className="rounded-xl border border-white/60 px-5 py-3 font-semibold hover:bg-white/20">
            Sign In
          </Link>
        </div>
      </div>
      <Footer />
    </main>
  );
}
