import { Footer } from "../components/Footer";
import { Logo } from "../components/Logo";

export default function Privacy() {
  return (
    <main className="min-h-screen px-4 py-6">
      <article className="mx-auto max-w-4xl rounded-3xl p-6 glass">
        <Logo compact />
        <h1 className="mt-4 text-3xl font-bold">Privacy Policy</h1>
        <p className="mt-2 text-xs opacity-70">Effective date: March 11, 2026</p>
        <div className="mt-5 space-y-4 text-sm leading-7 opacity-90">
          <p><strong>Data We Collect:</strong> Name, email, encrypted password hash, chat messages, and account timestamps.</p>
          <p><strong>How Chats Are Stored:</strong> Conversations are stored in MongoDB to support history, continuity, and user controls such as deletion and clearing.</p>
          <p><strong>Protection Measures:</strong> Passwords are hashed using bcrypt, API access is secured using JWT tokens, and sensitive credentials are managed with environment variables.</p>
          <p><strong>File Uploads:</strong> Uploaded files are processed for summarization and are not intended for permanent storage by default in this implementation.</p>
          <p><strong>Your Controls:</strong> You can request deletion by deleting your account, which removes user data and chats from the platform database.</p>
          <p><strong>Lawful Basis and Consent:</strong> By creating an account, you consent to processing required to operate the service, including storing your account and chat data.</p>
          <p><strong>Retention:</strong> Data is retained while your account is active and deleted when you remove your account, except where limited retention is required for legal/security reasons.</p>
          <p><strong>Rights Requests:</strong> You can contact us to request access, correction, or deletion of your data at <a href="mailto:contact@arithmo.app" className="underline">contact@arithmo.app</a>.</p>
          <p><strong>International Use:</strong> If you use the service from different regions, you are responsible for local legal compliance where applicable.</p>
        </div>
      </article>
      <Footer />
    </main>
  );
}
