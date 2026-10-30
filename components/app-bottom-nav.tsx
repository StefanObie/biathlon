"use client";

import Link from "next/link";
import { Building2Icon, SettingsIcon, type LucideIcon } from "lucide-react";

import type { NavModel } from "@/lib/navigation/navigation";
import { cn } from "@/lib/utils";

/**
 * The fixed navigation on a phone. A per-heat screen has its own bar in this
 * spot, whose drawer carries these same links instead.
 */
export function AppBottomNav({ model }: { model: NavModel }) {
  if (model.heatScreen) return null;
  const settings = model.league?.settings;

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 grid auto-cols-fr grid-flow-col border-t bg-background pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <BottomLink
        href={model.organization.href}
        active={model.organization.active}
        icon={Building2Icon}
        label="Organization"
      />
      {settings && (
        <BottomLink
          href={settings.href}
          active={settings.active}
          icon={SettingsIcon}
          label="League settings"
        />
      )}
    </nav>
  );
}

function BottomLink({
  href,
  active,
  icon: Icon,
  label,
}: {
  href: string;
  active: boolean;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-16 flex-col items-center justify-center gap-1 text-xs active:bg-accent",
        active ? "font-medium text-foreground" : "text-muted-foreground",
      )}
    >
      <Icon className="size-5" aria-hidden />
      {label}
    </Link>
  );
}
