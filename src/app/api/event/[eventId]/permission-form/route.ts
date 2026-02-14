import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { auth0 } from "@/lib/auth0";
import {
  calendarEventsCollection,
  classesCollection,
} from "@/lib/db/collections";

/**
 * GET /api/event/[eventId]/permission-form
 * Returns the permission form PDF for preview. Teachers only.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const session = await auth0.getSession(request);
  if (!session?.user?.sub) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { eventId } = await params;
  if (!eventId || !/^[a-f0-9]{24}$/i.test(eventId)) {
    return new Response("Invalid event ID", { status: 400 });
  }

  try {
    const events = await calendarEventsCollection();
    const event = await events.findOne({
      _id: new ObjectId(eventId),
    });
    if (!event) {
      return new Response("Event not found", { status: 404 });
    }

    const classes = await classesCollection();
    let cls = event.classId
      ? await classes.findOne({ _id: new ObjectId(event.classId) })
      : null;
    if (!cls) {
      cls = await classes.findOne({
        schoolId: event.schoolId,
        teacherIds: session.user.sub,
      });
    }
    if (!cls || !cls.teacherIds?.includes(session.user.sub)) {
      return new Response("Access denied", { status: 403 });
    }

    if (!event.permissionFormPdfBase64) {
      return new Response("No permission form uploaded yet.", {
        status: 404,
      });
    }

    const buffer = Buffer.from(event.permissionFormPdfBase64, "base64");
    const pdfBytes = new Uint8Array(buffer);

    const filename = `permission-form-${event.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.pdf`;
    return new Response(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("[event/permission-form] Error:", error);
    return new Response("Failed to load PDF", { status: 500 });
  }
}
