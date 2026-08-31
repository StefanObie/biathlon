import { Suspense } from "react";
import { redirect } from "next/navigation";

export default function MeetIndexPage({
  params,
}: {
  params: Promise<{ meetId: string }>;
}) {
  return (
    <Suspense fallback={null}>
      <RedirectToStartList params={params} />
    </Suspense>
  );
}

async function RedirectToStartList({
  params,
}: {
  params: Promise<{ meetId: string }>;
}): Promise<never> {
  const { meetId } = await params;
  redirect(`/meets/${meetId}/start-list`);
}
