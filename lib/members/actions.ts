"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export interface MemberChangeResult {
  error?: string;
}

// 23514: the database refused to leave the Organization without an Admin.
const LAST_ADMIN_MESSAGE =
  "An organization must keep at least one Admin. Make someone else an Admin first.";

function describe(error: { code?: string; message: string }): string {
  return error.code === "23514" ? LAST_ADMIN_MESSAGE : error.message;
}

/**
 * Makes a Member an Admin, or demotes an Admin to an ordinary Member. The
 * database checks the caller is an Admin, refuses to demote the last one,
 * and writes the change to the audit log.
 */
export async function setMemberAdmin(
  organizationId: number,
  userId: string,
  makeAdmin: boolean,
): Promise<MemberChangeResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_admin", {
    org_id: organizationId,
    member_user_id: userId,
    make_admin: makeAdmin,
  });
  if (error) return { error: describe(error) };

  revalidatePath(`/organizations/${organizationId}/members`);
  return {};
}

/**
 * Removes a Member from the Organization, ending their team entries so they
 * lose access to all its Leagues. Like demoting, the database refuses to
 * remove the last Admin.
 */
export async function removeMember(
  organizationId: number,
  userId: string,
): Promise<MemberChangeResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_member", {
    org_id: organizationId,
    member_user_id: userId,
  });
  if (error) return { error: describe(error) };

  revalidatePath(`/organizations/${organizationId}/members`);
  return {};
}
