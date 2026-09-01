import { SessionForm } from "@/components/backtesting/SessionForm";

export default function NewBacktestSessionPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-text">New Backtesting Session</h1>
      <SessionForm />
    </div>
  );
}
