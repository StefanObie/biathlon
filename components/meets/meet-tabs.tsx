"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export function MeetTabs({
  meetId,
  tabs,
}: {
  meetId: string;
  tabs: readonly { href: string; label: string }[];
}) {
  const pathname = usePathname();
  const active = tabs.find((tab) =>
    pathname.startsWith(`/meets/${meetId}/${tab.href}`),
  )?.href;

  return (
    <nav
      role="tablist"
      className="flex w-full items-center justify-start gap-1 border-b"
    >
      {tabs.map((tab) => {
        const isActive = tab.href === active;
        return (
          <Link
            key={tab.href}
            href={`/meets/${meetId}/${tab.href}`}
            role="tab"
            aria-selected={isActive}
            className={cn(
              "relative inline-flex items-center justify-center gap-1.5 px-2 py-1.5 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground",
              "after:absolute after:inset-x-0 after:bottom-[-1px] after:h-0.5 after:bg-transparent",
              isActive && "text-foreground after:bg-primary",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
