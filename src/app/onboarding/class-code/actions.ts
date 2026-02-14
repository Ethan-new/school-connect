"use server";

import { auth0 } from "@/lib/auth0";
import { joinClassByCode } from "@/lib/class-code";

export async function enterClassCode(
  code: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth0.getSession();
  if (!session?.user?.sub) {
    return { success: false, error: "Not authenticated" };
  }

  const result = await joinClassByCode(session.user.sub, code);
  return result.success
    ? { success: true }
    : { success: false, error: result.error };
}
