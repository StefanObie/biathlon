import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  ORGANIZATION_COOKIE,
  rememberedOrganizationId,
  resolveLanding,
} from "@/lib/organizations/landing";

export default function OrganizationsPage() {
  return (
    <Suspense fallback={<div className="h-24" />}>
      <Landing />
    </Suspense>
  );
}

// Lands on the remembered Organization, the user's only one, or Profile's
// Organization list. A user with no Organization goes to create one, unless an
// Invitation is waiting for them (#34).
async function Landing(): Promise<null> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) redirect("/auth/login");

  const { data: memberships } = await supabase
    .from("organization_member")
    .select("organization(id, name)")
    .eq("user_id", userId);
  const organizations = (memberships ?? [])
    .map((membership) => membership.organization)
    .sort((a, b) => a.name.localeCompare(b.name));

  if (organizations.length === 0) {
    const { data: pending } = await supabase.rpc("my_pending_invitations");
    redirect(
      pending && pending.length > 0
        ? "/organizations/pending-invitation"
        : "/organizations/new",
    );
  }

  const cookieStore = await cookies();
  const landing = resolveLanding(
    organizations.map((organization) => organization.id),
    rememberedOrganizationId(cookieStore.get(ORGANIZATION_COOKIE)?.value),
  );
  // No remembered Organization and several to choose from: Profile lists them.
  redirect(landing === "picker" ? "/profile" : `/organizations/${landing}`);
}
