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
 * IMPORTANT: We preserve the user's existing role if they've already selected one
 * (roleSelectedAt set), since Auth0 app_metadata doesn't store our role choice.
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

    const existingUser = await users.findOne({ auth0Id });

    let role: UserRole;
    let schoolId: string | null;
    if (existingUser?.roleSelectedAt) {
      role = existingUser.role;
      schoolId = appMetadata?.schoolId ?? existingUser.schoolId ?? null;
    } else {
      role = parseRole(appMetadata?.role ?? "parent");
      schoolId = appMetadata?.schoolId ?? null;
    }

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
        $setOnInsert: { createdAt: now, roleSelectedAt: null },
      },
      { upsert: true }
    );
  } catch (error) {
    console.error("[syncUserToDb] Failed to sync user to MongoDB:", error);
    // Don't throw - auth should succeed even if DB sync fails
  }
}

/**
 * Updates the user's role after they select parent or teacher on first login.
 */
export async function setUserRole(auth0Id: string, role: UserRole): Promise<boolean> {
  if (!isDbConfigured()) return false;
  if (!VALID_ROLES.includes(role) || role === "admin") return false;

  try {
    const users = await usersCollection();
    const result = await users.updateOne(
      { auth0Id },
      {
        $set: {
          role,
          roleSelectedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );
    return result.modifiedCount > 0 || result.matchedCount > 0;
  } catch (error) {
    console.error("[setUserRole] Failed to update role:", error);
    return false;
  }
}

/**
 * Fetches the MongoDB user record by Auth0 ID.
 * Returns null if MongoDB is not configured or user not found.
 * Throws on connection/network errors so callers can show a retry UI instead of onboarding.
 */
export async function getDbUser(auth0Id: string): Promise<User | null> {
  if (!isDbConfigured()) return null;

  try {
    const users = await usersCollection();
    const user = await users.findOne({ auth0Id });
    return user;
  } catch (error) {
    console.error("[getDbUser] Failed to fetch user from MongoDB:", error);
    throw error;
  }
}
