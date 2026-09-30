import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { NoAccess } from "@/components/leagues/no-access";
import { MembersList } from "@/components/members/members-list";

export default function MembersPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  return (
    <Suspense
      fallback={<p className="text-muted-foreground">Loading members…</p>}
    >
      <MembersSection params={params} />
    </Suspense>
  );
}

// Only an Admin of the Organization manages its Members; the database
// functions enforce that, and this shows everyone else "no access" rather
// than an empty page.
async function MembersSection({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const organizationIdNum = Number(organizationId);
  if (!Number.isInteger(organizationIdNum)) notFound();

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) return <NoAccess />;

  const { data: membership } = await supabase
    .from("organization_member")
    .select("is_admin, organization(name)")
    .eq("organization_id", organizationIdNum)
    .eq("user_id", userId)
    .maybeSingle();
  if (!membership?.is_admin) {
    return (
      <NoAccess>
        Only the organization&apos;s Admins can manage its members.
      </NoAccess>
    );
  }

  const { data: members, error } = await supabase.rpc("organization_members", {
    org_id: organizationIdNum,
  });
  if (error) {
    return <p className="text-sm text-destructive">{error.message}</p>;
  }

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <div>
        <Link
          href={`/leagues#organization-${organizationIdNum}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Leagues
        </Link>
        <h1 className="text-2xl font-bold">
          Members of {membership.organization.name}
        </h1>
      </div>
      <MembersList
        organizationId={organizationIdNum}
        rows={(members ?? []).map((member) => ({
          userId: member.user_id,
          email: member.email,
          isAdmin: member.is_admin,
          isYou: member.user_id === userId,
        }))}
      />
    </div>
  );
}
