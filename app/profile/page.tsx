import { Suspense } from "react";
import Link from "next/link";

import { signOut } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/server";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="h-24" />}>
      <Profile />
    </Suspense>
  );
}

async function Profile() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub ?? "";

  const { data: memberships } = await supabase
    .from("organization_member")
    .select("organization(id, name)")
    .eq("user_id", userId);
  const organizations = (memberships ?? [])
    .map((membership) => membership.organization)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-sm text-muted-foreground">{claims?.claims.email}</p>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Organizations</h2>
        {organizations.length === 0 && (
          <p className="text-sm text-muted-foreground">
            You&apos;re not in an organization yet.
          </p>
        )}
        {organizations.map((organization) => (
          <Link
            key={organization.id}
            href={`/organizations/${organization.id}`}
          >
            <Card className="hover:bg-accent transition-colors">
              <CardHeader>
                <CardTitle>{organization.name}</CardTitle>
              </CardHeader>
            </Card>
          </Link>
        ))}
        <Button asChild variant="outline" size="sm" className="self-start">
          <Link href="/organizations/new">Create organization</Link>
        </Button>
      </section>

      <section className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">Theme</h2>
        <ThemeSwitcher />
      </section>

      <form action={signOut}>
        <Button type="submit" variant="outline">
          Log out
        </Button>
      </form>
    </div>
  );
}
