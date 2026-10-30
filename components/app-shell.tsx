import { Suspense } from "react";

import { AppHeader } from "@/components/app-header";
import { BottomNavSpacer } from "@/components/app-navigation";

/** The fixed navigation and page frame shared by every signed-in screen. */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col lg:pl-60">
      <Suspense
        fallback={
          <>
            <div className="h-14 w-full border-b lg:hidden" />
            <div className="fixed inset-y-0 left-0 hidden w-60 border-r lg:block" />
          </>
        }
      >
        <AppHeader />
      </Suspense>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 p-4 lg:p-6">
        {children}
      </main>
      <Suspense>
        <BottomNavSpacer />
      </Suspense>
    </div>
  );
}
