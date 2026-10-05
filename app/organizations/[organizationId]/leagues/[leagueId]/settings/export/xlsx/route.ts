import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { canUse } from "@/lib/access/roles";
import { getLeagueAccess } from "@/lib/access/league-access";
import { buildResultsXlsx } from "@/lib/export/build-xlsx";
import { getExportData } from "@/lib/export/query";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ organizationId: string; leagueId: string }> },
) {
  const { organizationId, leagueId } = await params;
  const organizationIdNum = Number(organizationId);
  const leagueIdNum = Number(leagueId);
  if (!Number.isInteger(organizationIdNum) || !Number.isInteger(leagueIdNum)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const access = await getLeagueAccess(organizationIdNum, leagueIdNum);
  if (!access || !canUse(access, "export")) {
    return NextResponse.json({ error: "No access" }, { status: 403 });
  }

  const supabase = await createClient();
  const { rows, leagueDate } = await getExportData(supabase, leagueIdNum);

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "No results to export" },
      { status: 409 },
    );
  }

  const xlsx = await buildResultsXlsx(rows);
  const suffix = leagueDate ?? String(leagueIdNum);

  return new NextResponse(new Uint8Array(xlsx), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="league-${leagueIdNum}-${suffix}.xlsx"`,
    },
  });
}
