import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

// A placeholder until the Organization home replaces the /leagues list:
// where an Invitation lands someone with no League Role.
export default function OrganizationPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  return (
    <Suspense fallback={<div className="h-24" />}>
      <OrganizationSection params={params} />
    </Suspense>
  );
}

async function OrganizationSection({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const organizationIdNum = Number(organizationId);
  if (!Number.isInteger(organizationIdNum)) notFound();

  const supabase = await createClient();
  const { data: organization } = await supabase
    .from("organization")
    .select("name")
    .eq("id", organizationIdNum)
    .maybeSingle();
  if (!organization) notFound();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{organization.name}</h1>
      <div>
        <Button asChild variant="outline">
          <Link href={`/leagues#organization-${organizationIdNum}`}>
            See its leagues
          </Link>
        </Button>
      </div>
    </div>
  );
}
