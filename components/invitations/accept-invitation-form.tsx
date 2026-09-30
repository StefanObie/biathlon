"use client";

import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";

/**
 * Posts the Invitation link's token to accept it, straight away. The
 * "Continue" button is there for when scripts are blocked. Posting rather
 * than following the link is what stops a mail scanner that only fetches
 * pages from using the link up.
 */
export function AcceptInvitationForm({ token }: { token: string }) {
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    form.current?.submit();
  }, []);

  return (
    <form ref={form} method="post" action="/auth/invitation/accept">
      <input type="hidden" name="token" value={token} />
      <Button type="submit">Continue</Button>
    </form>
  );
}
