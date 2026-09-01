export function ComingSoon({
  title,
  phase,
}: {
  title: string;
  phase: string;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-start justify-center gap-2">
      <h1 className="text-2xl font-semibold text-text">{title}</h1>
      <p className="text-sm text-text-muted">
        Not built yet — landing in{" "}
        <span className="text-accent">{phase}</span>.
      </p>
    </div>
  );
}
