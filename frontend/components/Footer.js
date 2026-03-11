import Link from "next/link";

export function Footer() {
  return (
    <footer className="mx-auto mt-8 w-full max-w-7xl rounded-2xl px-6 py-4 text-sm glass">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p>&copy; 2026 Arithmo</p>
        <div className="flex items-center gap-4">
          <Link href="/terms" className="hover:underline">
            Terms & Conditions
          </Link>
          <Link href="/privacy" className="hover:underline">
            Privacy Policy
          </Link>
          <Link href="/contact" className="hover:underline">
            Contact
          </Link>
        </div>
      </div>
    </footer>
  );
}
