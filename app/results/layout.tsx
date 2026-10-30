import { Suspense } from "react";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { Logo } from "@/components/logo";
import { createClient } from "@/lib/supabase/server";

export default function ResultsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<div className="h-14 w-full border-b" />}>
      <ResultsFrame>{children}</ResultsFrame>
    </Suspense>
  );
}

// Anyone can open results. A signed-in Member keeps their navigation; a
// visitor has nowhere to navigate to but the home page.
async function ResultsFrame({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (data?.claims) return <AppShell>{children}</AppShell>;

  return (
    <>
      <header className="flex h-14 w-full items-center border-b px-4">
        <Link
          href="/"
          className="flex min-h-11 items-center gap-2 text-sm font-medium"
        >
          <Logo size={28} />
          Crossland Biathlon
        </Link>
      </header>
      <main>{children}</main>
    </>
  );
}
