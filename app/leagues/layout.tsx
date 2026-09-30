import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";

// Auth-gates the whole /leagues subtree: the redirect decision itself needs
// the session before anything below can render, so there's no static shell
// to show first (the documented case for this opt-out, see
// https://nextjs.org/docs/messages/blocking-prerender-dynamic#allow-blocking-route).
export const instant = false;

export default async function LeaguesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect("/auth/login");
  }

  // Every League belongs to an Organization, so a user who belongs to none
  // has nothing here yet: send them to create one (#30), unless an Invitation is waiting for them.
  const { count } = await supabase
    .from("organization_member")
    .select("*", { count: "exact", head: true })
    .eq("user_id", data.claims.sub);
  if (count === 0) {
    // Someone with a pending Invitation is about to join one, so they
    // aren't sent to create their own (#34).
    const { data: pending } = await supabase.rpc("my_pending_invitations");
    redirect(
      pending && pending.length > 0
        ? "/organizations/pending-invitation"
        : "/organizations/new",
    );
  }

  return <AppShell>{children}</AppShell>;
}
