import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";

// Auth-gated like /leagues, and for the same reason blocks on the session
// (see app/leagues/layout.tsx).
export const instant = false;

export default async function OrganizationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect("/auth/login");
  }

  return <AppShell>{children}</AppShell>;
}
