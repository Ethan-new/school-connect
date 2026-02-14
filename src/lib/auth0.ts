import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { syncUserToDb } from "./sync-user";
import type { UserRole } from "./db/types";

export const auth0 = new Auth0Client({
  beforeSessionSaved: async (session) => {
    const user = session.user as {
      sub: string;
      email?: string | null;
      name?: string | null;
      picture?: string | null;
      app_metadata?: { role?: string; schoolId?: string };
    };
    const appMetadata = user.app_metadata;
    await syncUserToDb(
      user.sub,
      user.email ?? null,
      user.name ?? null,
      user.picture ?? null,
      appMetadata
        ? {
            role: appMetadata.role as UserRole | undefined,
            schoolId: appMetadata.schoolId ?? null,
          }
        : undefined
    );
    return session;
  },
});
