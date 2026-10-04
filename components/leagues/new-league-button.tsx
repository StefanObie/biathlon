"use client";

import { Button } from "@/components/ui/button";
import { CreateLeagueForm } from "@/components/leagues/create-league-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** Opens the create League form, preset to this Organization. */
export function NewLeagueButton({
  organization,
}: {
  organization: { id: number; name: string };
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm">New league</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New league in {organization.name}</DialogTitle>
        </DialogHeader>
        <CreateLeagueForm organizations={[organization]} />
      </DialogContent>
    </Dialog>
  );
}
