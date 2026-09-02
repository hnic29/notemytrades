/** The app's brand mark — public/logo.png. Centralized here so every
 * nav header, share page, and the onboarding welcome screen render the
 * exact same file instead of each hand-rolling its own <img>. */
export function Logo({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/logo.png" alt="Note My Trades" className={className} />
  );
}
