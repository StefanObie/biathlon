import { Suspense } from "react";
import Link from "next/link";

import { AuthButton } from "@/components/auth-button";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center">
      <div className="flex-1 w-full flex flex-col gap-20 items-center">
        <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
          <div className="w-full max-w-5xl flex justify-between items-center p-3 px-5 text-sm">
            <Link href="/" className="font-semibold">
              Gauteng North Biathlon
            </Link>
            <Suspense>
              <AuthButton />
            </Suspense>
          </div>
        </nav>
        <div className="flex-1 flex flex-col gap-8 max-w-2xl p-5 items-center text-center">
          <h1 className="text-3xl font-bold">Gauteng North Biathlon</h1>
          <p className="text-muted-foreground">
            Race-day results system for entry import, roster management, and bib
            generation.
          </p>
          <Button asChild>
            <Link href="/leagues">Go to leagues</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
