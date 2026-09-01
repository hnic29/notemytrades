import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { isOnboarded } from "@/lib/queries/settings";

// Every page here reads live from SQLite. This is a local, single-user
// app with trivial request volume, so we trade away static/ISR caching
// for the simplicity of never having to remember a revalidatePath call
// to avoid stale data.
export const dynamic = "force-dynamic";

export default async function AppGroupLayout({ children }: LayoutProps<"/">) {
  if (!(await isOnboarded())) redirect("/onboarding");

  return <AppShell>{children}</AppShell>;
}
