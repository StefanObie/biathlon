import { Suspense } from "react";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Where someone with no Organization but a pending Invitation lands, instead
// of "Create organization" (#34). The Invitation link in their email is what
// accepts it.
export default function PendingInvitationPage() {
  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">You&apos;ve been invited</CardTitle>
        <CardDescription>
          <Suspense fallback="Checking your invitations…">
            <Invitations />
          </Suspense>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <p>
          Open the link in your invitation email to join. If it&apos;s lost, ask
          an admin to send it again.
        </p>
        <Button asChild variant="outline" size="sm" className="self-start">
          <Link href="/organizations/new">Create my own organization</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

async function Invitations() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_pending_invitations");
  const names = (data ?? []).map((row) => row.organization_name);
  return names.length > 0
    ? `Pending invitation${names.length > 1 ? "s" : ""}: ${names.join(", ")}.`
    : "You have no pending invitations.";
}
