import Link from "next/link";

export function Logo({ compact = false }) {
  return (
    <Link href="/" className="inline-flex items-center gap-3">
      <img src="/logo-icon.svg" alt="Arithmo logo" className="h-10 w-10" />
      {!compact && <img src="/logo-wordmark.svg" alt="Arithmo" className="h-8" />}
    </Link>
  );
}
