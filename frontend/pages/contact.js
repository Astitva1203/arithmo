import { Footer } from "../components/Footer";
import { Logo } from "../components/Logo";

export default function Contact() {
  return (
    <main className="min-h-screen px-4 py-6">
      <article className="mx-auto max-w-3xl rounded-3xl p-6 glass">
        <Logo compact />
        <h1 className="mt-4 text-3xl font-bold">Contact</h1>
        <p className="mt-4 text-sm leading-7 opacity-90">
          For support, partnerships, or legal/privacy requests, email us at
          <a className="ml-1 font-semibold underline" href="mailto:astitvapandey1203@gmail.com">
            astitvapandey1203@gmail.com
          </a>
          .
        </p>
      </article>
      <Footer />
    </main>
  );
}
