"use server";

import { revalidatePath } from "next/cache";
import { auth0 } from "@/lib/auth0";
import { setParentName } from "@/lib/sync-user";

export async function saveParentName(
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
  const ok = await setParentName(session.user.sub, name);
  if (!ok) return { success: false, error: "Failed to save name" };

  revalidatePath("/onboarding", "layout");
  revalidatePath("/", "layout");

  return { success: true };
}
