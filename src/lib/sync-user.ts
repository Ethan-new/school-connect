import type { User, UserRole } from "./db/types";
import { usersCollection } from "./db/collections";
import { isDbConfigured } from "./db";

const VALID_ROLES: UserRole[] = ["parent", "teacher", "admin"];

function parseRole(value: unknown): UserRole {
  if (typeof value === "string" && VALID_ROLES.includes(value as UserRole)) {
    return value as UserRole;
  }
  return "parent";
}

/**
 * Upserts the Auth0 user into MongoDB. Call from beforeSessionSaved.
 * Links Auth0 identity (sub) to your application's user record.
 * Role and schoolId can come from Auth0 app_metadata (set via Actions/Rules).
 */
export async function syncUserToDb(
  auth0Id: string,
  email: string | null,
  name: string | null,
  picture: string | null,
  options?: { role?: UserRole; schoolId?: string | null }
): Promise<void> {
  if (!isDbConfigured()) return;

  try {
    const users = await usersCollection();
    const now = new Date();

    const appMetadata = options?.role !== undefined || options?.schoolId !== undefined
      ? options
      : undefined;

    const role = parseRole(appMetadata?.role ?? "parent");
    const schoolId = appMetadata?.schoolId ?? null;

    await users.updateOne(
      { auth0Id },
      {
        $set: {
          auth0Id,
          role,
          email: email ?? null,
          name: name ?? null,
          picture: picture ?? null,
          schoolId,
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true }
    );
  } catch (error) {
    console.error("[syncUserToDb] Failed to sync user to MongoDB:", error);
    // Don't throw - auth should succeed even if DB sync fails
  }
}

/**
 * Fetches the MongoDB user record by Auth0 ID.
 * Returns null if MongoDB is not configured or user not found.
 */
export async function getDbUser(auth0Id: string): Promise<User | null> {
  if (!isDbConfigured()) return null;

  try {
    const users = await usersCollection();
    const user = await users.findOne({ auth0Id });
    return user;
  } catch (error) {
    console.error("[getDbUser] Failed to fetch user from MongoDB:", error);
    return null;
  }
}
