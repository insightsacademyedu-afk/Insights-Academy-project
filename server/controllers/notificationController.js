import Notification from "../models/Notification.js";
import NotificationRecipient from "../models/NotificationRecipient.js";
import Guardian from "../models/Guardian.js";
import Staff from "../models/Staff.js";
import StudentClassAssignment from "../models/StudentClassAssignment.js";
import { buildListQuery, paginatedResponse } from "../utils/listQuery.js";
import { processNotification, retryFailedRecipients } from "../jobs/notificationWorker.js";

// Resolves an audience spec into guardian/staff documents. Deduping
// happens later by destination (not just by id) - that's what prevents
// two students sharing one parent's phone number from generating two
// identical SMS sends, the exact scenario the spec calls out.
async function resolveAudience(audience) {
  let guardianIds = [];
  let staffIds = [];

  if (audience.type === "class_section") {
    const assignments = await StudentClassAssignment.find({
      class: audience.classId,
      section: audience.sectionId,
      academicSession: audience.academicSession,
      status: "active",
      archivedAt: null,
    }).populate({ path: "student", select: "guardian" });

    guardianIds = [...new Set(assignments.map((a) => a.student?.guardian).filter(Boolean).map(String))];
  } else if (audience.type === "all_guardians") {
    guardianIds = (await Guardian.find({}, "_id")).map((g) => String(g._id));
  } else if (audience.type === "staff") {
    staffIds = audience.staffIds || [];
  } else if (audience.type === "all_staff") {
    staffIds = (await Staff.find({ status: "active", archivedAt: null }, "_id")).map((s) => String(s._id));
  } else {
    throw Object.assign(new Error("Unknown or unsupported audience type"), { status: 400 });
  }

  const guardians = guardianIds.length ? await Guardian.find({ _id: { $in: guardianIds } }) : [];
  const staff = staffIds.length ? await Staff.find({ _id: { $in: staffIds }, archivedAt: null }) : [];

  return { guardians, staff };
}

// Builds the channel-specific destination for one contact, or null if
// they don't have that channel's contact info at all (e.g. no email on
// file) - those are simply skipped rather than creating a broken row.
function destinationFor(channel, contact) {
  if (channel === "in_app") return String(contact._id); // in-app has no "address", just needs a row to exist
  if (channel === "email") return contact.email || null;
  if (channel === "whatsapp") return contact.whatsappPhone || contact.primaryPhone || null;
  if (channel === "sms") return contact.primaryPhone || contact.phone || null;
  return null;
}

export async function create(req, res, next) {
  try {
    const { title, body, channels = ["in_app"], audience, audienceDescription = "" } = req.body;

    if (!title || !body || !audience) {
      return res.status(400).json({ message: "title, body and audience are required" });
    }

    const { guardians, staff } = await resolveAudience(audience);

    const notification = await Notification.create({
      title,
      body,
      channels,
      createdBy: req.user._id,
      audienceDescription,
    });

    // Dedup key: channel + destination. A guardian shared across two
    // students, or appearing in both a guardian and staff list somehow,
    // still only gets one row per channel.
    const seen = new Set();
    const rows = [];

    const contacts = [
      ...guardians.map((g) => ({ recipientType: "guardian", recipientId: g._id, contact: g })),
      ...staff.map((s) => ({ recipientType: "staff", recipientId: s._id, contact: s })),
    ];

    for (const channel of channels) {
      for (const { recipientType, recipientId, contact } of contacts) {
        const destination = destinationFor(channel, contact);
        if (!destination) continue; // no contact info for this channel - skip, don't fail the batch

        const key = `${channel}:${destination}`;
        if (seen.has(key)) continue;
        seen.add(key);

        rows.push({
          notification: notification._id,
          recipientType,
          recipientId,
          channel,
          destination,
        });
      }
    }

    if (rows.length > 0) {
      await NotificationRecipient.insertMany(rows, { ordered: false });
    }

    // Fire-and-await the worker synchronously since there's no queue
    // infrastructure (Redis/BullMQ) in the free-tier setup - fine at
    // small-academy volume. If this ever needs to scale, swap this call
    // for enqueueing a real job and let a separate worker process pick it
    // up; nothing else in this file would need to change.
    await processNotification(notification._id);

    const finalNotification = await Notification.findById(notification._id);
    const recipientCount = await NotificationRecipient.countDocuments({ notification: notification._id });

    res.status(201).json({ notification: finalNotification, recipientCount });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    next(err);
  }
}

export async function list(req, res, next) {
  try {
    const { filter, page, limit, skip, sort } = buildListQuery(req.query, {
      searchFields: ["title"],
      exactFilters: ["status"],
    });

    const [items, total] = await Promise.all([
      Notification.find(filter).sort(sort).skip(skip).limit(limit),
      Notification.countDocuments(filter),
    ]);

    res.json(paginatedResponse(items, total, page, limit));
  } catch (err) {
    next(err);
  }
}

export async function getOne(req, res, next) {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) return res.status(404).json({ message: "Not found" });

    const recipients = await NotificationRecipient.find({ notification: notification._id });
    const summary = recipients.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {});

    res.json({ notification, recipients, deliverySummary: summary });
  } catch (err) {
    next(err);
  }
}

export async function retryFailed(req, res, next) {
  try {
    const result = await retryFailedRecipients();
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// In-app notifications for the currently logged-in user (guardian portal
// is future work per the spec, so today this covers staff/admin viewing
// their own in-app notifications).
export async function mine(req, res, next) {
  try {
    if (!req.user.staffId) return res.json({ items: [] });

    const items = await NotificationRecipient.find({
      recipientType: "staff",
      recipientId: req.user.staffId,
      channel: "in_app",
    })
      .populate("notification")
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ items });
  } catch (err) {
    next(err);
  }
}
