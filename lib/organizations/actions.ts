"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export interface CreateOrganizationState {
  error?: string;
}

/**
 * Creates an Organization with the signed-in user as its only Admin (#30),
 * then shows them its home.
 */
export async function createOrganization(
  _prevState: CreateOrganizationState,
  formData: FormData,
): Promise<CreateOrganizationState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { error: "Organization name is required." };
  }

  const supabase = await createClient();
  const { data: organizationId, error } = await supabase.rpc(
    "create_organization",
    { org_name: name },
  );

  if (error || organizationId === null) {
    return { error: error?.message ?? "Failed to create organization." };
  }

  redirect(`/organizations/${organizationId}`);
}
