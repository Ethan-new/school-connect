"use server";

import { auth0 } from "@/lib/auth0";
import { setTeacherName } from "@/lib/sync-user";

export async function saveTeacherName(
  firstName: string,
  lastName: string
): Promise<{ success: boolean; error?: string }> {
  const first = firstName?.trim();
  const last = lastName?.trim();
  if (!first || !last) {
    return { success: false, error: "First and last name are required" };
  }

  const session = await auth0.getSession();
  if (!session?.user?.sub) {
    return { success: false, error: "Not authenticated" };
  }

  const name = `${first} ${last}`;
  const ok = await setTeacherName(session.user.sub, name);
  if (!ok) return { success: false, error: "Failed to save name" };

  return { success: true };
}
