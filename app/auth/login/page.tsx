import { Suspense } from "react";

import { LoginForm } from "@/components/login-form";
import { safeNextPath } from "@/lib/auth/next-path";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Suspense>
          <Form searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

// Where to go once signed in: back to an Invitation link, say, or by
// default the Organizations page.
async function Form({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return <LoginForm next={safeNextPath(next) ?? undefined} />;
}
