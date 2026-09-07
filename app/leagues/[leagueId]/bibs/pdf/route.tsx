import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";

import { createClient } from "@/lib/supabase/server";
import { BibsDocument } from "@/lib/pdf/bib-document";

// Node.js is the only runtime under Cache Components (Edge is deprecated
// as of Next.js 16.3, see https://nextjs.org/docs/messages/edge-runtime-deprecated)
// and is also the only one @react-pdf/renderer can run on (spec §5.2) — no
// `runtime` export needed, and one is now a build error alongside
// cacheComponents.

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ meetId: string }> },
) {
  const { meetId } = await params;
  const meetIdNum = Number(meetId);
  if (!Number.isInteger(meetIdNum)) {
    return NextResponse.json({ error: "Invalid meet id" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: entries, error } = await supabase
    .from("entry")
    .select("athlete_no, run_heat, swim_heat, swim_lane, athlete(full_name)")
    .eq("meet_id", meetIdNum)
    .order("athlete_no");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const athletes = (entries ?? [])
    .map((entry) => ({
      athleteNo: entry.athlete_no,
      fullName: entry.athlete?.full_name ?? "",
      runHeat: entry.run_heat,
      swimHeat: entry.swim_heat,
      swimLane: entry.swim_lane,
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));

  const buffer = await renderToBuffer(<BibsDocument athletes={athletes} />);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="bibs-meet-${meetIdNum}.pdf"`,
    },
  });
}
