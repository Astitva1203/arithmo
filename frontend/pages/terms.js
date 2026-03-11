import { Footer } from "../components/Footer";
import { Logo } from "../components/Logo";

export default function Terms() {
  return (
    <main className="min-h-screen px-4 py-6">
      <article className="mx-auto max-w-4xl rounded-3xl p-6 glass">
        <Logo compact />
        <h1 className="mt-4 text-3xl font-bold">Terms & Conditions</h1>
        <p className="mt-2 text-xs opacity-70">Effective date: March 11, 2026</p>
        <div className="mt-5 space-y-4 text-sm leading-7 opacity-90">
          <p><strong>Acceptable Use:</strong> You agree not to use Arithmo for illegal activity, abuse, malware generation, harassment, or rights infringement.</p>
          <p><strong>User Responsibility:</strong> You are responsible for prompts, uploaded content, and any actions you take based on AI responses.</p>
          <p><strong>AI Content Disclaimer:</strong> AI responses may be inaccurate or incomplete. Verify critical information before relying on it for legal, medical, financial, or safety decisions.</p>
          <p><strong>Data Storage Policy:</strong> We store account metadata and chat history to provide continuity and product features. You can clear chats or delete your account from Settings.</p>
          <p><strong>Intellectual Property:</strong> You must have rights to upload and process any content you submit. Do not upload confidential material without proper authorization.</p>
          <p><strong>Account Security:</strong> You are responsible for maintaining password confidentiality and all activity under your account.</p>
          <p><strong>Termination:</strong> We may suspend accounts that violate these terms or pose security or legal risk.</p>
          <p><strong>Service Changes:</strong> Features may evolve over time. Continued usage implies acceptance of updated terms.</p>
          <p><strong>Contact:</strong> For legal notices and support, contact <a href="mailto:contact@arithmo.app" className="underline">contact@arithmo.app</a>.</p>
        </div>
      </article>
      <Footer />
    </main>
  );
}
