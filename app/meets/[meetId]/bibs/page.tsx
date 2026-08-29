import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function BibsPage({
  params,
}: {
  params: Promise<{ meetId: string }>;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Athlete bibs</CardTitle>
          <CardDescription>
            One bib per entry: QR code, athlete number, name, and heat
            assignments.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={null}>
            <BibsDownloadLink params={params} />
          </Suspense>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Position cards</CardTitle>
          <CardDescription>
            Reusable, numbered 1–20. Print once — not tied to a specific meet or
            athlete.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={null}>
            <PositionCardsDownloadLink params={params} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}

async function BibsDownloadLink({
  params,
}: {
  params: Promise<{ meetId: string }>;
}) {
  const { meetId } = await params;
  return (
    <Button asChild>
      <a href={`/meets/${meetId}/bibs/pdf`} target="_blank" rel="noreferrer">
        Download bibs PDF
      </a>
    </Button>
  );
}

async function PositionCardsDownloadLink({
  params,
}: {
  params: Promise<{ meetId: string }>;
}) {
  const { meetId } = await params;
  return (
    <Button asChild variant="outline">
      <a
        href={`/meets/${meetId}/bibs/position-cards`}
        target="_blank"
        rel="noreferrer"
      >
        Download position cards PDF
      </a>
    </Button>
  );
}
