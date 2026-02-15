"use server";

import { auth0 } from "@/lib/auth0";
import { setUserRole } from "@/lib/sync-user";
import type { UserRole } from "@/lib/db/types";

export async function selectRole(
  role: UserRole
): Promise<{ success: boolean; redirectTo?: string; error?: string }> {
  if (role !== "parent" && role !== "teacher") {
    return { success: false, error: "Invalid role" };
  }

  const session = await auth0.getSession();
  if (!session?.user?.sub) {
    return { success: false, error: "Not authenticated" };
  }

  const ok = await setUserRole(session.user.sub, role);
  if (!ok) return { success: false, error: "Failed to save role" };

  return {
    success: true,
    redirectTo: role === "parent" ? "/onboarding/parent-name" : "/onboarding/create-class",
  };
}
