import Link from "next/link";
import { Logo } from "./Logo";

export function AuthCard({ title, subtitle, children, altHref, altText, altLabel }) {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-6">
      <section className="glass w-full max-w-md rounded-3xl p-7">
        <div className="mb-6 flex justify-center">
          <Logo compact />
        </div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mb-5 text-sm opacity-80">{subtitle}</p>
        {children}
        <p className="mt-4 text-sm opacity-80">
          {altText} <Link href={altHref} className="font-semibold hover:underline">{altLabel}</Link>
        </p>
      </section>
    </main>
  );
}
