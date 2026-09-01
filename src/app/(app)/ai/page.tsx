import { AiChat } from "@/components/ai/AiChat";

export default function AiPage() {
  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-text">AI Insights</h1>
      <p className="mb-6 text-sm text-text-faint">
        Powered by your local Omniroute gateway. Every answer is grounded in your own logged
        trades — nothing is sent anywhere except the endpoint configured in AI_BASE_URL.
      </p>
      <AiChat />
    </div>
  );
}
