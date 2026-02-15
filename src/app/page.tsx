import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth0 } from "@/lib/auth0";
import { getDbUser } from "@/lib/sync-user";
import { parentHasJoinedClass } from "@/lib/class-code";
import { teacherHasClass } from "@/lib/teacher-class";
import { getParentDashboardData } from "@/lib/parent-dashboard";
import { getTeacherDashboardData } from "@/lib/teacher-dashboard";
import { isDbConfigured } from "@/lib/db";
import { ParentDashboard } from "./components/parent-dashboard";
import { TeacherDashboard } from "./components/teacher-dashboard";

export default async function Home() {
  const session = await auth0.getSession();

  if (!session) {
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
                className="mb-8 h-10 w-auto"
                priority
              />
              <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
                School Connect
              </h1>
              <p className="mt-2 text-center text-sm text-zinc-600">
                Sign in to get started.
              </p>
              <div className="mt-8 flex w-full flex-col gap-3">
                <a
                  href="/auth/login?screen_hint=signup"
                  className="flex h-11 w-full items-center justify-center rounded-lg bg-red-600 px-5 text-sm font-medium text-white transition-colors hover:bg-red-700"
                >
                  Sign up
                </a>
                <a
                  href="/auth/login"
                  className="flex h-11 w-full items-center justify-center rounded-lg border border-zinc-300 bg-white px-5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
                >
                  Log in
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  let dbUser: Awaited<ReturnType<typeof getDbUser>> = null;
  if (isDbConfigured()) {
    try {
      dbUser = await getDbUser(session.user.sub);
    } catch {
      return (
        <div className="min-h-screen bg-zinc-50 font-sans">
          <div className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-4 py-16 sm:px-6">
            <div className="w-full max-w-sm overflow-hidden rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
              <div className="flex flex-col items-center text-center">
                <Image
                  src="/logo_yrdsb_desktop.svg"
                  alt="York Region District School Board"
                  width={160}
                  height={50}
                  className="mb-6 h-10 w-auto"
                />
                <h1 className="text-xl font-semibold text-zinc-900">
                  Database temporarily unavailable
                </h1>
                <p className="mt-2 text-sm text-zinc-600">
                  We could not connect to the database. Common causes:
                </p>
                <ul className="mt-2 list-inside list-disc text-left text-sm text-zinc-600">
                  <li>IP not allowed in MongoDB Atlas Network Access</li>
                  <li>VPN, firewall, or school/corporate network blocking MongoDB</li>
                  <li>Try adding 0.0.0.0/0 in Atlas Network Access for testing</li>
                </ul>
                <Link
                  href="/"
                  className="mt-6 flex h-11 w-full items-center justify-center rounded-lg bg-red-600 px-5 text-sm font-medium text-white hover:bg-red-700"
                >
                  Try again
                </Link>
                <a
                  href="/auth/logout"
                  className="mt-3 text-sm text-zinc-600 hover:text-zinc-900"
                >
                  Log out
                </a>
              </div>
            </div>
          </div>
        </div>
      );
    }
    if (!dbUser?.roleSelectedAt) {
      redirect("/onboarding");
    }
    if (dbUser.role === "parent") {
      if (!dbUser.parentNameSetAt) {
        redirect("/onboarding/parent-name");
      }
      if (!(await parentHasJoinedClass(session.user.sub))) {
        redirect("/onboarding/class-code");
      }
    }
    if (dbUser.role === "teacher") {
      if (!dbUser.teacherNameSetAt) {
        redirect("/onboarding/teacher-name");
      }
      if (!(await teacherHasClass(session.user.sub))) {
        redirect("/onboarding/create-class");
      }
    }
  }

  if (dbUser?.role === "parent" && isDbConfigured()) {
    const dashboardData = await getParentDashboardData(session.user.sub);
    return (
      <ParentDashboard
        userName={dbUser.name ?? session.user.name ?? null}
        classes={dashboardData.classes}
        upcomingEvents={dashboardData.upcomingEvents}
        permissionSlipTasks={dashboardData.permissionSlipTasks}
        inboxItems={dashboardData.inboxItems}
        reportCards={dashboardData.reportCards}
        interviewData={dashboardData.interviewData}
        conversations={dashboardData.conversations}
      />
    );
  }

  if (dbUser?.role === "teacher" && isDbConfigured()) {
    const dashboardData = await getTeacherDashboardData(session.user.sub);
    return (
      <TeacherDashboard
        userName={dbUser.name ?? session.user.name ?? null}
        classes={dashboardData.classes}
        upcomingEvents={dashboardData.upcomingEvents}
        permissionSlipEvents={dashboardData.permissionSlipEvents}
        permissionSlipStatus={dashboardData.permissionSlipStatus}
        reportCards={dashboardData.reportCards}
        interviewSlotsByClass={dashboardData.interviewSlotsByClass}
        studentsWithGuardians={dashboardData.studentsWithGuardians}
        conversationSummaries={dashboardData.conversationSummaries}
      />
    );
  }

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
            />
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
              User Profile
            </h1>
            <p className="mt-2 text-center text-sm text-zinc-600">
              Logged in as {session.user.email}
            </p>
            <pre className="mt-4 w-full max-w-md overflow-auto rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-left text-xs text-zinc-700">
              {JSON.stringify(session.user, null, 2)}
            </pre>
            <a
              href="/auth/logout"
              className="mt-6 flex h-11 w-full items-center justify-center rounded-lg border border-zinc-300 bg-white px-5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
            >
              Logout
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
