import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy - Arithmo AI',
  description: 'Privacy Policy for Arithmo AI platform.',
};

export default function PrivacyPage() {
  return (
    <div className="legal-page">
      <div className="bg-glow" />
      <div className="legal-container">
        <Link href="/" className="legal-back">&lt;- Back to Arithmo AI</Link>
        <h1>Privacy Policy</h1>
        <p className="legal-date">Last updated: May 5, 2026</p>

        <h2>1. Information We Collect</h2>
        <p>Arithmo AI collects account information such as email address, display name, profile image, plan status, settings, chat history, and usage counts needed to operate the service.</p>

        <h2>2. How We Use Your Information</h2>
        <p>We use this information to authenticate users, provide chat history, enforce free and premium limits, personalize settings, improve reliability, and protect the platform from misuse.</p>

        <h2>3. Authentication and Security</h2>
        <p>Authentication is handled through Firebase Authentication. Backend routes verify Firebase ID tokens before accessing protected data. User data is stored in MongoDB and handled securely. We do not share user data without authorization except when required by law or necessary to protect the service.</p>

        <h2>4. Third-Party Services</h2>
        <p>Arithmo AI may send prompts, images, or search queries to configured service providers only as needed to generate responses or perform requested features.</p>
        <ul>
          <li><strong>Groq API:</strong> Fast AI chat responses.</li>
          <li><strong>Google Gemini API:</strong> Balanced intelligence and multimodal reasoning when configured.</li>
          <li><strong>NVIDIA API:</strong> Deep reasoning responses when configured.</li>
          <li><strong>SerpAPI:</strong> Real-time web search for Search and Research modes when configured.</li>
          <li><strong>Freepik API:</strong> Image generation when configured.</li>
        </ul>

        <h2>5. Data Sharing</h2>
        <p>We do not sell, trade, or rent your personal data. We may disclose data only if required by law, to prevent abuse, or to protect users, the public, or the platform.</p>

        <h2>6. Data Retention and Deletion</h2>
        <p>Chat history is retained while your account is active so conversations can continue across sessions. You can delete chats in the app. To request account deletion, contact us.</p>

        <h2>7. Your Rights</h2>
        <p>You may request access, correction, export, or deletion of your personal data, subject to legal and technical limitations.</p>

        <h2>8. Children&apos;s Privacy</h2>
        <p>Arithmo AI is not intended for users under 13. If we discover that a user under 13 is using the service, we may terminate the account and delete related data.</p>

        <h2>9. Contact</h2>
        <p>For any privacy-related concerns, contact: <a href="mailto:techyou2026@gmail.com">techyou2026@gmail.com</a></p>
      </div>
    </div>
  );
}
