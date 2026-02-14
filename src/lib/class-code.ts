import { ObjectId } from "mongodb";
import { classesCollection } from "./db/collections";
import { isDbConfigured } from "./db";

/**
 * Joins a parent (by auth0Id) to a class using the class code.
 * Returns the class name on success, or an error message.
 */
export async function joinClassByCode(
  auth0Id: string,
  code: string
): Promise<{ success: true; className: string } | { success: false; error: string }> {
  if (!isDbConfigured()) {
    return { success: false, error: "Database not configured" };
  }

  const normalizedCode = code.trim().toUpperCase();
  if (!normalizedCode) {
    return { success: false, error: "Please enter a class code" };
  }

  try {
    const classes = await classesCollection();
    const cls = await classes.findOne({ code: normalizedCode });

    if (!cls) {
      return { success: false, error: "Class code not found. Please check and try again." };
    }

    const guardianIds = cls.guardianIds ?? [];
    if (guardianIds.includes(auth0Id)) {
      return { success: true, className: cls.name };
    }

    const result = await classes.updateOne(
      { _id: cls._id },
      {
        $addToSet: { guardianIds: auth0Id },
      }
    );

    if (result.modifiedCount === 0) {
      return { success: true, className: cls.name };
    }

    return { success: true, className: cls.name };
  } catch (error) {
    console.error("[joinClassByCode] Failed:", error);
    return { success: false, error: "Failed to join class. Please try again." };
  }
}

/**
 * Removes a parent from a class by their auth0Id and class id.
 */
export async function leaveClass(
  auth0Id: string,
  classId: string
): Promise<{ success: true } | { success: false; error: string }> {
  if (!isDbConfigured()) {
    return { success: false, error: "Database not configured" };
  }

  if (!classId || !classId.trim()) {
    return { success: false, error: "Invalid class" };
  }

  try {
    const classes = await classesCollection();
    const result = await classes.updateOne(
      { _id: new ObjectId(classId) },
      { $pull: { guardianIds: auth0Id } }
    );

    if (result.matchedCount === 0) {
      return { success: false, error: "Class not found" };
    }

    return { success: true };
  } catch (error) {
    console.error("[leaveClass] Failed:", error);
    return { success: false, error: "Failed to leave class. Please try again." };
  }
}

/**
 * Returns true if the parent has joined at least one class.
 */
export async function parentHasJoinedClass(auth0Id: string): Promise<boolean> {
  if (!isDbConfigured()) return false;

  try {
    const classes = await classesCollection();
    const count = await classes.countDocuments({
      guardianIds: auth0Id,
    });
    return count > 0;
  } catch (error) {
    console.error("[parentHasJoinedClass] Failed:", error);
    return false;
  }
}
