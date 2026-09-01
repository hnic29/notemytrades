import { redirect } from "next/navigation";
import { isOnboarded } from "@/lib/queries/settings";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  if (await isOnboarded()) redirect("/dashboard");

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-bg px-4 py-10 text-text"
      style={{
        backgroundImage:
          "radial-gradient(ellipse 80% 60% at 50% -10%, color-mix(in srgb, var(--color-accent) 12%, transparent), transparent)",
      }}
    >
      <OnboardingWizard
        defaultAiBaseUrl={process.env.AI_BASE_URL ?? ""}
        defaultAiModel={process.env.AI_MODEL ?? ""}
      />
    </div>
  );
}
