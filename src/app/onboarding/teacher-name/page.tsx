import Image from "next/image";
import { redirect } from "next/navigation";
import { auth0 } from "@/lib/auth0";
import { getDbUser } from "@/lib/sync-user";
import { teacherHasClass } from "@/lib/teacher-class";
import { isDbConfigured } from "@/lib/db";
import { TeacherNameForm } from "./teacher-name-form";

export default async function TeacherNamePage() {
  const session = await auth0.getSession();
  if (!session) {
    redirect("/auth/login");
  }

  if (!isDbConfigured()) {
    redirect("/");
  }

  const dbUser = await getDbUser(session.user.sub);
  if (!dbUser?.roleSelectedAt || dbUser.role !== "teacher") {
    redirect("/onboarding");
  }
  if (dbUser.teacherNameSetAt) {
    const hasClass = await teacherHasClass(session.user.sub);
    redirect(hasClass ? "/" : "/onboarding/create-class");
  }

  const hasClass = await teacherHasClass(session.user.sub);

  return (
    <div className="min-h-screen bg-zinc-50 font-sans">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-4 py-16 sm:px-6">
        <div className="w-full max-w-sm overflow-hidden rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col items-center">
            <Image
              src="/logo_yrdsb_desktop.svg"
              alt="York Region District School Board"
              width={160}
              height={50}
              className="mb-6 h-10 w-auto"
              priority
            />
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
              What&apos;s your name?
            </h1>
            <p className="mt-2 text-center text-sm text-zinc-600">
              We&apos;ll use this so parents can identify you when they connect
              to your classes.
            </p>
            <div className="mt-8 w-full">
              <TeacherNameForm
                initialName={dbUser.name}
                redirectTo={hasClass ? "/" : "/onboarding/create-class"}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
