import "../styles/globals.css";
import "highlight.js/styles/github-dark.css";
import { Toaster } from "react-hot-toast";
import React from "react";

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="grid min-h-screen place-items-center px-4">
          <div className="glass-panel rounded-3xl border border-white/30 p-8 text-center">
            <h1 className="text-2xl font-semibold">Something went wrong.</h1>
            <p className="mt-2 text-sm opacity-80">Please refresh and try again.</p>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}

export default function App({ Component, pageProps }) {
  return (
    <>
      <AppErrorBoundary>
        <Component {...pageProps} />
      </AppErrorBoundary>
      <Toaster position="top-right" />
    </>
  );
}
