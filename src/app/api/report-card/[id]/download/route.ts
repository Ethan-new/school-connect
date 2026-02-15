import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { auth0 } from "@/lib/auth0";
import {
  reportCardsCollection,
  studentsCollection,
  classesCollection,
} from "@/lib/db/collections";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth0.getSession(request);
  if (!session?.user?.sub) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return new Response("Missing report card ID", { status: 400 });
  }

  try {
    const reportCards = await reportCardsCollection();
    const students = await studentsCollection();
    const classes = await classesCollection();

    const rc = await reportCards.findOne({
      _id: new ObjectId(id),
    });

    if (!rc || !rc.pdfBase64) {
      return new Response("Report card not found", { status: 404 });
    }

    const student = await students.findOne({
      _id: new ObjectId(rc.studentId),
    });
    if (!student) {
      return new Response("Student not found", { status: 404 });
    }

    const isTeacher =
      rc.teacherId === session.user.sub ||
      (
        await classes
          .find({
            _id: {
              $in: (student.classIds ?? []).map((cid) => new ObjectId(cid)),
            },
            teacherIds: session.user.sub,
          })
          .toArray()
      ).length > 0;

    const isGuardian = student.guardianIds?.includes(session.user.sub) ?? false;

    if (!isTeacher && !isGuardian) {
      return new Response("Report card not found", { status: 404 });
    }

    if (isGuardian && rc.status !== "published") {
      return new Response("Report card not yet published", { status: 403 });
    }

    const pdfBuffer = Buffer.from(rc.pdfBase64, "base64");
    const filename = `report-card-${rc.term.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-${student.name?.replace(/[^a-z0-9]/gi, "-").toLowerCase() ?? "student"}.pdf`;

    const isPreview =
      request.nextUrl.searchParams.get("preview") === "1" ||
      request.nextUrl.searchParams.get("inline") === "1";
    const disposition = isPreview
      ? `inline; filename="${filename}"`
      : `attachment; filename="${filename}"`;

    return new Response(new Uint8Array(pdfBuffer) as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": disposition,
      },
    });
  } catch (error) {
    console.error("[report-card/download] Error:", error);
    return new Response("Failed to load PDF", { status: 500 });
  }
}
