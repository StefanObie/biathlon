"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * Moves between League settings screens, grouped by race phase. It scrolls
 * sideways on a phone, keeping the open screen in view. The hub lists all of
 * these itself, so it doesn't show this.
 */
export function SettingsNav({
  home,
  phases,
}: {
  home: string;
  phases: { title: string; links: { title: string; href: string }[] }[];
}) {
  const pathname = usePathname();
  const activeLink = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    activeLink.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname]);

  if (pathname === home || phases.length === 0) return null;

  return (
    <nav
      aria-label="League settings"
      className="-mx-4 flex gap-4 overflow-x-auto border-b px-4 [scrollbar-width:none] lg:-mx-6 lg:px-6"
    >
      {phases.map((phase) => (
        <div key={phase.title} className="flex shrink-0 flex-col">
          <span className="text-xs text-muted-foreground">{phase.title}</span>
          <div className="flex gap-1">
            {phase.links.map((link) => {
              const active =
                pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  ref={active ? activeLink : undefined}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center whitespace-nowrap border-b-2 px-1 text-sm",
                    active
                      ? "border-foreground font-medium"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {link.title}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
