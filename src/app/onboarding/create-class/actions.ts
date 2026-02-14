"use server";

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

  return result.success
    ? { success: true, code: result.code, className: result.className }
    : { success: false, error: result.error };
}
