import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { auth0 } from "@/lib/auth0";
import {
  eventPermissionSlipsCollection,
  calendarEventsCollection,
  classesCollection,
} from "@/lib/db/collections";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slipId: string }> }
) {
  const session = await auth0.getSession(request);
  if (!session?.user?.sub) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { slipId } = await params;
  if (!slipId) {
    return new Response("Missing slip ID", { status: 400 });
  }

  try {
    const slips = await eventPermissionSlipsCollection();
    const slip = await slips.findOne({
      _id: new ObjectId(slipId),
    });

    if (!slip) {
      return new Response("Permission slip not found", { status: 404 });
    }

    const classes = await classesCollection();
    const cls = await classes.findOne({
      _id: new ObjectId(slip.classId),
    });
    if (!cls) {
      return new Response("Class not found", { status: 404 });
    }

    const isGuardian = slip.guardianId === session.user.sub;
    const isTeacher = cls.teacherIds?.includes(session.user.sub);
    if (!isGuardian && !isTeacher) {
      return new Response("Permission slip not found", { status: 404 });
    }

    const events = await calendarEventsCollection();
    const event = await events.findOne({
      _id: new ObjectId(slip.eventId),
    });
    if (!event) {
      return new Response("Event not found", { status: 404 });
    }

    let pdfBytes: Uint8Array;

    if (slip.status === "signed" && slip.signedPdfBase64) {
      const buffer = Buffer.from(slip.signedPdfBase64, "base64");
      pdfBytes = new Uint8Array(buffer);
    } else if (event.permissionFormPdfBase64) {
      const buffer = Buffer.from(event.permissionFormPdfBase64, "base64");
      pdfBytes = new Uint8Array(buffer);
    } else {
      return new Response(
        "Permission form not yet available. The teacher needs to upload a form.",
        { status: 404 }
      );
    }

    const filename = `permission-slip-${event.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.pdf`;
    const isPreview =
      request.nextUrl.searchParams.get("preview") === "1" ||
      request.nextUrl.searchParams.get("inline") === "1";
    const disposition = isPreview
      ? `inline; filename="${filename}"`
      : `attachment; filename="${filename}"`;

    return new Response(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": disposition,
      },
    });
  } catch (error) {
    console.error("[permission-slip/download] Error:", error);
    return new Response("Failed to generate PDF", { status: 500 });
  }
}
