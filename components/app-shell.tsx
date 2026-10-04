import Link from "next/link";
import { Suspense } from "react";

import { AuthButton } from "@/components/auth-button";
import { ThemeSwitcher } from "@/components/theme-switcher";

/** The nav bar and page frame shared by every signed-in screen. */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex flex-col items-center">
      <div className="flex-1 w-full flex flex-col items-center">
        <nav className="w-full flex justify-center border-b border-b-foreground/10 h-14">
          <div className="w-full max-w-5xl flex justify-between items-center px-5 text-sm">
            <Link href="/organizations" className="font-semibold">
              Crossland Biathlon
            </Link>
            <div className="flex items-center gap-2">
              <ThemeSwitcher />
              <Suspense>
                <AuthButton />
              </Suspense>
            </div>
          </div>
        </nav>
        <div className="flex-1 flex flex-col gap-4 w-full max-w-5xl p-5">
          {children}
        </div>
      </div>
    </main>
  );
}
