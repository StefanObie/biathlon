import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";

import { PositionCardsDocument } from "@/lib/pdf/position-cards-document";

// Node.js is the only runtime under Cache Components (Edge is deprecated
// as of Next.js 16.3) and is also the only one @react-pdf/renderer can run
// on (spec §5.2) — no `runtime` export needed, and one is now a build
// error alongside cacheComponents.

export async function GET() {
  const buffer = await renderToBuffer(<PositionCardsDocument />);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="position-cards.pdf"',
    },
  });
}
