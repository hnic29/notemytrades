"use client";

/**
 * Last-resort boundary for errors outside the (app) route group (root
 * layout, onboarding). Replaces the entire document when it fires, so
 * it must render its own <html>/<body> — kept intentionally plain
 * (no theme tokens/fonts) since this is the "even the app shell broke"
 * fallback.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          background: "#0a0e17",
          color: "#e2e8f0",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <h1 style={{ fontSize: "1.125rem", fontWeight: 600 }}>Something went wrong</h1>
        <button
          onClick={reset}
          style={{
            borderRadius: "0.375rem",
            background: "#14b8a6",
            color: "#0a0e17",
            padding: "0.5rem 1rem",
            fontSize: "0.875rem",
            fontWeight: 500,
            border: "none",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
