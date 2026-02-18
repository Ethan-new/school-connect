"use server";

import { revalidatePath } from "next/cache";
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
  if (!result.success) {
    return { success: false, error: result.error };
  }

  revalidatePath("/onboarding", "layout");
  revalidatePath("/", "layout");

  return { success: true };
}
