import { Suspense } from "react";

import { AppHeader } from "@/components/app-header";

/** The header and page frame shared by every signed-in screen. */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex flex-col items-center">
      <div className="flex-1 w-full flex flex-col items-center">
        <Suspense fallback={<div className="h-12 w-full border-b" />}>
          <AppHeader />
        </Suspense>
        <div className="flex-1 flex flex-col gap-4 w-full max-w-5xl p-5">
          {children}
        </div>
      </div>
    </main>
  );
}
