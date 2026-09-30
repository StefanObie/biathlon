import { Suspense } from "react";

import { AcceptInvitationForm } from "@/components/invitations/accept-invitation-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// The Invitation link. Loading this page does nothing to the Invitation:
// the form it shows posts the token to /auth/invitation/accept.
export default function InvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">
              Accepting your invitation
            </CardTitle>
            <CardDescription>
              You&apos;ll be signed in and taken to your organization.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense>
              <Continue searchParams={searchParams} />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

async function Continue({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) {
    return (
      <p className="text-sm text-muted-foreground">
        This invitation link is incomplete. Open the link in your email again.
      </p>
    );
  }
  return <AcceptInvitationForm token={token} />;
}
