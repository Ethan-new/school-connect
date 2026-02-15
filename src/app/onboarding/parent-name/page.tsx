import Image from "next/image";
import { redirect } from "next/navigation";
import { auth0 } from "@/lib/auth0";
import { getDbUser } from "@/lib/sync-user";
import { parentHasJoinedClass } from "@/lib/class-code";
import { isDbConfigured } from "@/lib/db";
import { ParentNameForm } from "./parent-name-form";

export default async function ParentNamePage() {
  const session = await auth0.getSession();
  if (!session) {
    redirect("/auth/login");
  }

  if (!isDbConfigured()) {
    redirect("/");
  }

  const dbUser = await getDbUser(session.user.sub);
  if (!dbUser?.roleSelectedAt || dbUser.role !== "parent") {
    redirect("/onboarding");
  }
  if (dbUser.parentNameSetAt) {
    const hasJoined = await parentHasJoinedClass(session.user.sub);
    redirect(hasJoined ? "/" : "/onboarding/class-code");
  }

  const hasJoinedClass = await parentHasJoinedClass(session.user.sub);

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
              We&apos;ll use this so teachers can identify you when you connect
              to their classes.
            </p>
            <div className="mt-8 w-full">
              <ParentNameForm
                initialName={dbUser.name}
                redirectTo={hasJoinedClass ? "/" : "/onboarding/class-code"}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
