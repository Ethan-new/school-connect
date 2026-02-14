import { schoolsCollection, classesCollection, usersCollection } from "./db/collections";
import { isDbConfigured } from "./db";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

function generateCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

async function generateUniqueCode(): Promise<string> {
  const classes = await classesCollection();
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = generateCode();
    const existing = await classes.findOne({ code });
    if (!existing) return code;
  }
  return generateCode() + Date.now().toString(36).slice(-2);
}

/**
 * Creates a school and class for a teacher. Returns the class with its code.
 */
export async function createTeacherClass(
  auth0Id: string,
  schoolName: string,
  className: string,
  term: string
): Promise<
  | { success: true; code: string; className: string }
  | { success: false; error: string }
> {
  if (!isDbConfigured()) {
    return { success: false, error: "Database not configured" };
  }

  const trimmedSchool = schoolName.trim();
  const trimmedClass = className.trim();
  const trimmedTerm = term.trim();

  if (!trimmedSchool) return { success: false, error: "School name is required" };
  if (!trimmedClass) return { success: false, error: "Class name is required" };
  if (!trimmedTerm) return { success: false, error: "Term is required" };
  if (trimmedSchool.length > 100) return { success: false, error: "School name is too long" };
  if (trimmedClass.length > 100) return { success: false, error: "Class name is too long" };

  try {
    const schools = await schoolsCollection();
    const classes = await classesCollection();
    const users = await usersCollection();

    const schoolResult = await schools.insertOne({
      name: trimmedSchool,
      createdAt: new Date(),
    });
    const schoolId = schoolResult.insertedId?.toString();
    if (!schoolId) return { success: false, error: "Failed to create school" };

    const code = await generateUniqueCode();

    await classes.insertOne({
      schoolId,
      name: trimmedClass,
      code,
      teacherIds: [auth0Id],
      studentIds: [],
      guardianIds: [],
      term: trimmedTerm,
      createdAt: new Date(),
    });

    await users.updateOne(
      { auth0Id },
      {
        $set: {
          schoolId,
          updatedAt: new Date(),
        },
      }
    );

    return {
      success: true,
      code,
      className: trimmedClass,
    };
  } catch (error) {
    console.error("[createTeacherClass] Failed:", error);
    return { success: false, error: "Failed to create class. Please try again." };
  }
}

/**
 * Returns true if the teacher has at least one class they teach.
 */
export async function teacherHasClass(auth0Id: string): Promise<boolean> {
  if (!isDbConfigured()) return false;

  try {
    const classes = await classesCollection();
    const count = await classes.countDocuments({ teacherIds: auth0Id });
    return count > 0;
  } catch (error) {
    console.error("[teacherHasClass] Failed:", error);
    return false;
  }
}
