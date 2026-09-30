"use client";

import { useState, useTransition } from "react";

import { cancelInvitation } from "@/lib/invitations/actions";
import { Button } from "@/components/ui/button";

export interface PendingInvitationRow {
  id: string;
  email: string;
  roleText: string;
  expiresOn: string;
  sentBy: string;
}

export function PendingInvitations({
  organizationId,
  rows,
}: {
  organizationId: number;
  rows: PendingInvitationRow[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No pending invitations.</p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <ul className="flex flex-col divide-y rounded-md border">
        {rows.map((row) => (
          <li
            key={row.id}
            className="flex items-center justify-between gap-4 p-3"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{row.email}</p>
              <p className="text-sm text-muted-foreground">
                {row.roleText} · expires {row.expiresOn} · sent by {row.sentBy}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await cancelInvitation(organizationId, row.id);
                  setError(result.error ?? null);
                })
              }
            >
              Cancel
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
