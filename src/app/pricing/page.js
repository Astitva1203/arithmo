'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Sparkles, X } from 'lucide-react';
import { resilientFetch } from '@/lib/resilientFetch';

const FEATURES = [
  ['Chat messages', '50/day', 'Unlimited'],
  ['Search queries', '3/day', 'Unlimited'],
  ['Research mode', '1/day', 'Unlimited'],
  ['Deep Mode NVIDIA', false, true],
  ['Smart Mode Gemini', false, true],
  ['Image generation', '3/day', 'Extended'],
  ['Advanced learning tools', false, true],
  ['Response speed', 'Standard', 'Priority'],
];

const DEFAULT_PAYMENT_MESSAGE = 'Online payments are currently disabled. We are working on enabling subscriptions soon. Thank you for your patience.';

function FeatureValue({ value }) {
  if (value === true) return <Check size={18} className="pricing-check" />;
  if (value === false) return <X size={18} className="pricing-x" />;
  return <span>{value}</span>;
}

export default function PricingPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [message, setMessage] = useState(DEFAULT_PAYMENT_MESSAGE);

  const handleUpgrade = async () => {
    try {
      const res = await resilientFetch('/api/billing/checkout', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      setMessage(data.message || DEFAULT_PAYMENT_MESSAGE);
    } catch {
      setMessage(DEFAULT_PAYMENT_MESSAGE);
    }
    setModalOpen(true);
  };

  const handleContactOpen = () => {
    setModalOpen(false);
    setContactModalOpen(true);
  };

  return (
    <main className="pricing-page">
      <div className="pricing-bg" />
      <section className="pricing-hero">
        <Link href="/" className="pricing-back">Back to Arithmo</Link>
        <div className="pricing-kicker"><Sparkles size={16} /> Arithmo Pro</div>
        <h1>More power when you need it.</h1>
        <p>Arithmo is free to start. Pro unlocks deeper reasoning, higher limits, and premium learning tools.</p>
      </section>

      <section className="pricing-cards">
        <article className="pricing-card">
          <span className="pricing-plan-label">Free</span>
          <h2>₹0</h2>
          <p>For everyday learning and quick questions.</p>
          <ul>
            <li>50 chats per day</li>
            <li>3 searches per day</li>
            <li>1 research brief per day</li>
            <li>3 images per day</li>
          </ul>
          <Link className="pricing-secondary-btn" href="/">Continue Free</Link>
        </article>

        <article className="pricing-card featured">
          <span className="pricing-plan-label">Pro</span>
          <h2>₹299 <small>/ month</small></h2>
          <p>For users who want full speed, deep reasoning, and advanced research.</p>
          <ul>
            <li>Unlimited chats, search, and research</li>
            <li>Deep Mode with NVIDIA</li>
            <li>Smart Mode with Gemini</li>
            <li>Advanced learning features</li>
          </ul>
          <button className="pricing-primary-btn" type="button" onClick={handleUpgrade}>
            Upgrade Now
          </button>
        </article>
      </section>

      <section className="pricing-table-wrap">
        <h2>Compare Plans</h2>
        <div className="pricing-table">
          <div className="pricing-row header">
            <span>Feature</span>
            <span>Free</span>
            <span>Pro</span>
          </div>
          {FEATURES.map(([feature, free, pro]) => (
            <div className="pricing-row" key={feature}>
              <span>{feature}</span>
              <span><FeatureValue value={free} /></span>
              <span><FeatureValue value={pro} /></span>
            </div>
          ))}
        </div>
      </section>

      {modalOpen && (
        <div className="payment-modal-backdrop" role="presentation" onClick={() => setModalOpen(false)}>
          <div className="payment-modal" role="dialog" aria-modal="true" aria-labelledby="payment-modal-title" onClick={(event) => event.stopPropagation()}>
            <button className="payment-modal-close" type="button" onClick={() => setModalOpen(false)} aria-label="Close">
              <X size={18} />
            </button>
            <h2 id="payment-modal-title">Payments currently disabled</h2>
            <p>{message}</p>
            <div className="payment-modal-actions">
              <button className="pricing-secondary-btn" type="button" onClick={handleContactOpen}>
                Contact for payments
              </button>
              <button className="pricing-primary-btn" type="button" onClick={() => setModalOpen(false)}>
                Okay
              </button>
            </div>
          </div>
        </div>
      )}

      {contactModalOpen && (
        <div className="payment-modal-backdrop" role="presentation" onClick={() => setContactModalOpen(false)}>
          <div className="payment-modal contact" role="dialog" aria-modal="true" aria-labelledby="contact-modal-title" onClick={(event) => event.stopPropagation()}>
            <button className="payment-modal-close" type="button" onClick={() => setContactModalOpen(false)} aria-label="Close">
              <X size={18} />
            </button>
            <h2 id="contact-modal-title">Contact for payments</h2>
            <p>
              Online payments are disabled, but you can still upgrade your plan by contacting us or email us at{' '}
              <a href="mailto:techyou2026@gmail.com">techyou2026@gmail.com</a>. We will reply within 2 days.
            </p>
            <div className="payment-modal-actions">
              <button className="pricing-primary-btn" type="button" onClick={() => setContactModalOpen(false)}>
                Okay
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
