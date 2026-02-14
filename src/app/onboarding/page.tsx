import Image from "next/image";
import { redirect } from "next/navigation";
import { auth0 } from "@/lib/auth0";
import { getDbUser } from "@/lib/sync-user";
import { isDbConfigured } from "@/lib/db";
import { RoleSelectForm } from "./role-select-form";

export default async function OnboardingPage() {
  const session = await auth0.getSession();
  if (!session) {
    redirect("/auth/login");
  }

  if (!isDbConfigured()) {
    redirect("/");
  }

  const dbUser = await getDbUser(session.user.sub);
  if (dbUser?.roleSelectedAt) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-center gap-10 px-6 py-16 sm:px-16">
        <Image
          className="dark:invert"
          src="/next.svg"
          alt="Next.js logo"
          width={100}
          height={20}
          priority
        />
        <div className="flex flex-col items-center gap-6 text-center">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight text-black dark:text-zinc-50">
            Welcome to School Connect
          </h1>
          <p className="max-w-sm text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
            Are you a parent or a teacher? This helps us customize your experience.
          </p>
        </div>
        <RoleSelectForm />
      </main>
    </div>
  );
}
