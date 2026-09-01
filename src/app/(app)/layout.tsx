import { AppShell } from "@/components/layout/AppShell";

// Every page here reads live from SQLite. This is a local, single-user
// app with trivial request volume, so we trade away static/ISR caching
// for the simplicity of never having to remember a revalidatePath call
// to avoid stale data.
export const dynamic = "force-dynamic";

export default function AppGroupLayout({ children }: LayoutProps<"/">) {
  return <AppShell>{children}</AppShell>;
}
