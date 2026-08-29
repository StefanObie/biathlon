import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

const TABS = [
  { href: "import", label: "Import" },
  { href: "roster", label: "Roster" },
  { href: "bibs", label: "Bibs & Cards" },
] as const;

export default function MeetLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ meetId: string }>;
}) {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<div className="h-14" />}>
        <MeetHeader params={params} />
      </Suspense>
      <Suspense fallback={null}>
        <MeetTabs params={params} />
      </Suspense>
      {children}
    </div>
  );
}

async function MeetHeader({ params }: { params: Promise<{ meetId: string }> }) {
  const { meetId } = await params;
  const meetIdNum = Number(meetId);
  if (!Number.isInteger(meetIdNum)) notFound();

  const supabase = await createClient();
  const { data: meet } = await supabase
    .from("meet")
    .select("id, name, meet_date, season")
    .eq("id", meetIdNum)
    .maybeSingle();

  if (!meet) notFound();

  return (
    <div>
      <Link
        href="/meets"
        className="text-sm text-muted-foreground hover:underline"
      >
        ← All meets
      </Link>
      <h1 className="text-2xl font-bold">{meet.name}</h1>
      <p className="text-sm text-muted-foreground">
        {meet.meet_date} · Season {meet.season}
      </p>
    </div>
  );
}

async function MeetTabs({ params }: { params: Promise<{ meetId: string }> }) {
  const { meetId } = await params;

  return (
    <nav className="flex gap-4 border-b">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={`/meets/${meetId}/${tab.href}`}
          className="pb-2 text-sm font-medium text-muted-foreground hover:text-foreground border-b-2 border-transparent"
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
