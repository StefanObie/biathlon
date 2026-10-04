import { Suspense } from "react";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  ORGANIZATION_COOKIE,
  rememberedOrganizationId,
  resolveLanding,
} from "@/lib/organizations/landing";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

export default function OrganizationsPage() {
  return (
    <Suspense fallback={<div className="h-24" />}>
      <Landing />
    </Suspense>
  );
}

// Lands on the remembered Organization, the user's only one, or shows the
// picker. A user with no Organization goes to create one, unless an
// Invitation is waiting for them (#34).
async function Landing() {
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
  if (landing !== "picker") redirect(`/organizations/${landing}`);

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Your organizations</h1>
        <Button asChild variant="outline" size="sm">
          <Link href="/organizations/new">Create organization</Link>
        </Button>
      </div>
      {organizations.map((organization) => (
        <Link key={organization.id} href={`/organizations/${organization.id}`}>
          <Card className="hover:bg-accent transition-colors">
            <CardHeader>
              <CardTitle>{organization.name}</CardTitle>
            </CardHeader>
          </Card>
        </Link>
      ))}
    </div>
  );
}
