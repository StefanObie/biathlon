import { Suspense } from "react";

import { ImportEntriesForm } from "@/components/meets/import-entries-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ImportPage({
  params,
}: {
  params: Promise<{ meetId: string }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Import entries</CardTitle>
        <p className="text-sm text-muted-foreground">
          Columns needed (any order): Age Group, Athlete name, Athlete No, Run
          Heat, Swim Heat, Swim Lane. Re-importing updates existing athletes by
          athlete number.
        </p>
      </CardHeader>
      <CardContent>
        <Suspense fallback={null}>
          <ImportForm params={params} />
        </Suspense>
      </CardContent>
    </Card>
  );
}

async function ImportForm({ params }: { params: Promise<{ meetId: string }> }) {
  const { meetId } = await params;
  return <ImportEntriesForm meetId={Number(meetId)} />;
}
