import api from "./client";

// Notifications does NOT use createResourceApi — server/routes/notificationRoutes.js
// has no PUT/DELETE at all (an announcement is sent once; there's no
// "editing" a notification after the fact, only retrying failed
// deliveries), and it has one extra split most other modules don't:
// `GET /mine` is reachable by *any* authenticated user (staff or admin),
// while every other route here (`create`/`list`/`getOne`/`retry-failed`)
// is admin-only — confirmed by re-reading notificationRoutes.js's two
// separate `router.use(requireRole(...))` calls.
export const notificationsApi = {
  // POST /notifications — { title, body, channels?, audience,
  // audienceDescription? }. `channels` defaults to ["in_app"] server-side
  // if omitted. `audience` is a discriminated shape (see
  // notificationController.js#resolveAudience):
  //   { type: "class_section", classId, sectionId, academicSession }
  //   { type: "all_guardians" }
  //   { type: "staff", staffIds: [id, ...] }
  //   { type: "all_staff" }
  // Returns { notification, recipientCount } — recipients are already
  // resolved, deduped by destination, and the worker has already run
  // synchronously by the time this resolves (see the controller's own
  // comment on why there's no queue), so the returned notification's
  // `status` is normally already "completed", not "queued".
  create(body) {
    return api.post("/notifications", body).then((r) => r.data);
  },
  // GET /notifications — {items,page,limit,total,totalPages}. Supports
  // `search` (title only) and an exact `status` filter
  // (queued/processing/completed/failed).
  list(params = {}) {
    return api.get("/notifications", { params }).then((r) => r.data);
  },
  // GET /notifications/:id — NOT a bare notification: returns
  // { notification, recipients, deliverySummary }, where deliverySummary
  // is a plain { [status]: count } map built server-side.
  getOne(id) {
    return api.get(`/notifications/${id}`).then((r) => r.data);
  },
  // POST /notifications/retry-failed — no body, no id. Retries every
  // failed recipient row across every notification whose `attempts` is
  // still under the worker's maxAttempts ceiling (3) — NOT scoped to one
  // notification, confirmed by re-reading
  // jobs/notificationWorker.js#retryFailedRecipients. Returns
  // { retriedCount }.
  retryFailed() {
    return api.post("/notifications/retry-failed").then((r) => r.data);
  },
  // GET /notifications/mine — { items }, an array of NotificationRecipient
  // docs (channel: "in_app" only) with `notification` populated, newest
  // first, capped at 50 server-side. Returns { items: [] } rather than a
  // 403 for a user with no `staffId` on their account (see the
  // controller), so this is safe to call for any authenticated user.
  mine() {
    return api.get("/notifications/mine").then((r) => r.data);
  },
};
