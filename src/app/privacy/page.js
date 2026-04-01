import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy — Arithmo AI',
  description: 'Privacy Policy for Arithmo AI platform.',
};

export default function PrivacyPage() {
  return (
    <div className="legal-page">
      <div className="bg-glow" />
      <div className="legal-container">
        <Link href="/" className="legal-back">← Back to Arithmo AI</Link>
        <h1>Privacy Policy</h1>
        <p className="legal-date">Last updated: April 1, 2026</p>

        <h2>1. Information We Collect</h2>
        <p>When you use Arithmo AI, we collect the following information:</p>
        <ul>
          <li><strong>Account Information:</strong> Your email address, display name, and hashed password when you register.</li>
          <li><strong>Chat Data:</strong> Messages you send and AI responses, stored to provide persistent chat history.</li>
          <li><strong>Usage Data:</strong> Basic analytics such as timestamps and request counts for rate limiting purposes.</li>
        </ul>

        <h2>2. How We Use Your Information</h2>
        <p>Your information is used to:</p>
        <ul>
          <li>Provide and maintain the Service</li>
          <li>Store your chat history for persistent conversations</li>
          <li>Authenticate your identity and secure your account</li>
          <li>Improve the Service and user experience</li>
        </ul>

        <h2>3. Data Storage & Security</h2>
        <p>Your data is stored in a secure MongoDB database. Passwords are hashed using bcrypt and are never stored in plain text. Authentication uses JWT tokens with httpOnly cookies. We implement reasonable security measures to protect your information.</p>

        <h2>4. Third-Party Services</h2>
        <p>Arithmo AI uses the following third-party APIs to process your requests:</p>
        <ul>
          <li><strong>Groq API:</strong> For processing AI chat interactions. Your messages are sent to Groq&apos;s servers for inference. Please review <a href="https://groq.com/privacy-policy/" target="_blank" rel="noopener noreferrer">Groq&apos;s Privacy Policy</a>.</li>
        </ul>

        <h2>5. Data Sharing</h2>
        <p>We do <strong>not</strong> sell, trade, or rent your personal data to third parties. Your data may only be disclosed:</p>
        <ul>
          <li>As required by law or legal process</li>
          <li>To protect the rights, safety, or property of users or the public</li>
        </ul>

        <h2>6. Data Retention & Deletion</h2>
        <p>Your chat history is retained as long as your account is active. You can delete individual chats at any time through the application. To delete your account and all associated data, please contact us.</p>

        <h2>7. Your Rights</h2>
        <p>You have the right to:</p>
        <ul>
          <li>Access your personal data</li>
          <li>Request deletion of your data</li>
          <li>Export your chat history from the application</li>
          <li>Withdraw your consent at any time by deleting your account</li>
        </ul>

        <h2>8. Children&apos;s Privacy</h2>
        <p>Arithmo AI is not intended for children under 13. We do not knowingly collect personal information from children under 13.</p>

        <h2>9. Changes to This Policy</h2>
        <p>We may update this Privacy Policy from time to time. We will notify users of significant changes by posting the new policy on this page.</p>

        <h2>10. Contact</h2>
        <p>For questions about this Privacy Policy, contact us at: <a href="mailto:astitvapandey1203@gmail.com">astitvapandey1203@gmail.com</a></p>
      </div>
    </div>
  );
}
