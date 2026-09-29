import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

/** Shown instead of a League or screen the Member isn't allowed on. */
export function NoAccess() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>No access</EmptyTitle>
        <EmptyDescription>
          You don&apos;t have a Role that lets you use this. Ask an Admin of the
          organization to add you to the league&apos;s team.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild variant="outline">
          <Link href="/leagues">Back to leagues</Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}
