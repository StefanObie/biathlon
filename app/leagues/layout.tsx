import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

import { AuthButton } from "@/components/auth-button";
import { createClient } from "@/lib/supabase/server";

// Auth-gates the whole /leagues subtree: the redirect decision itself needs
// the session before anything below can render, so there's no static shell
// to show first (the documented case for this opt-out, see
// https://nextjs.org/docs/messages/blocking-prerender-dynamic#allow-blocking-route).
export const instant = false;

export default async function LeaguesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect("/auth/login");
  }

  return (
    <main className="min-h-screen flex flex-col items-center">
      <div className="flex-1 w-full flex flex-col items-center">
        <nav className="w-full flex justify-center border-b border-b-foreground/10 h-14">
          <div className="w-full max-w-5xl flex justify-between items-center px-5 text-sm">
            <Link href="/leagues" className="font-semibold">
              SA Biathlon Race Day
            </Link>
            <Suspense>
              <AuthButton />
            </Suspense>
          </div>
        </nav>
        <div className="flex-1 flex flex-col gap-4 w-full max-w-5xl p-5">
          {children}
        </div>
      </div>
    </main>
  );
}
