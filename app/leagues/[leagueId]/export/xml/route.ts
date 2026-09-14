import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { buildResultsXml } from "@/lib/export/build-xml";
import { getExportData } from "@/lib/export/query";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ leagueId: string }> },
) {
  const { leagueId } = await params;
  const leagueIdNum = Number(leagueId);
  if (!Number.isInteger(leagueIdNum)) {
    return NextResponse.json({ error: "Invalid league id" }, { status: 400 });
  }

  const supabase = await createClient();
  const { rows, leagueDate } = await getExportData(supabase, leagueIdNum);

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "No results to export" },
      { status: 409 },
    );
  }

  const xml = buildResultsXml(rows);
  const suffix = leagueDate ?? String(leagueIdNum);

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="league-${leagueIdNum}-${suffix}.xml"`,
    },
  });
}
