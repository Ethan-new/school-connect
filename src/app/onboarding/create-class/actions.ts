"use server";

import { revalidatePath } from "next/cache";
import { auth0 } from "@/lib/auth0";
import { createTeacherClass } from "@/lib/teacher-class";

export async function createClass(
  schoolName: string,
  className: string,
  term: string
): Promise<{ success: boolean; code?: string; className?: string; error?: string }> {
  const session = await auth0.getSession();
  if (!session?.user?.sub) {
    return { success: false, error: "Not authenticated" };
  }

  const result = await createTeacherClass(
    session.user.sub,
    schoolName,
    className,
    term
  );

  if (!result.success) {
    return { success: false, error: result.error };
  }

  revalidatePath("/onboarding", "layout");
  revalidatePath("/", "layout");

  return { success: true, code: result.code, className: result.className };
}
