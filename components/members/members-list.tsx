"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import {
  removeMember,
  setMemberAdmin,
  type MemberChangeResult,
} from "@/lib/members/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface MemberRow {
  userId: string;
  email: string;
  isAdmin: boolean;
  isYou: boolean;
}

/**
 * An Organization's Members with their Admin status. An Admin can make a
 * Member an Admin, demote an Admin, or remove a Member. The database
 * refuses to demote or remove the last Admin, and the reason is shown here.
 */
export function MembersList({
  organizationId,
  rows,
}: {
  organizationId: number;
  rows: MemberRow[];
}) {
  const [isPending, startTransition] = useTransition();

  function run(change: () => Promise<MemberChangeResult>) {
    startTransition(async () => {
      const { error } = await change();
      if (error) toast.error(error);
    });
  }

  return (
    <ul className="flex flex-col divide-y rounded-md border">
      {rows.map((row) => (
        <li
          key={row.userId}
          className="flex items-center justify-between gap-4 p-3"
        >
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate font-medium">{row.email}</p>
            {row.isYou && <Badge variant="outline">You</Badge>}
            {row.isAdmin && <Badge variant="secondary">Admin</Badge>}
          </div>
          <div className="flex shrink-0 gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() =>
                run(() =>
                  setMemberAdmin(organizationId, row.userId, !row.isAdmin),
                )
              }
            >
              {row.isAdmin ? "Demote" : "Make Admin"}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" disabled={isPending}>
                  Remove
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove {row.email}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    They lose access to every league of this organization,
                    including the Default team and all league teams.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() =>
                      run(() => removeMember(organizationId, row.userId))
                    }
                  >
                    Remove
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </li>
      ))}
    </ul>
  );
}
