import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Notifications from "./Notifications";

// Same AppLayout -> Sidebar/Topbar/MobileNav requirement every page test
// in this codebase already deals with (see Fees.test.jsx/Tests.test.jsx).
const mockUseAuth = vi.fn();
vi.mock("../context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

const mockToast = { success: vi.fn(), error: vi.fn() };
vi.mock("../context/ToastContext", () => ({
  useToast: () => mockToast,
}));

vi.mock("../api/academicSetup", () => ({
  academicSessionsApi: { list: vi.fn() },
  classesApi: { list: vi.fn() },
  sectionsApi: { list: vi.fn() },
}));

vi.mock("../api/staff", () => ({
  staffApi: { list: vi.fn() },
}));

vi.mock("../api/notifications", () => ({
  notificationsApi: {
    list: vi.fn(),
    getOne: vi.fn(),
    create: vi.fn(),
    retryFailed: vi.fn(),
    mine: vi.fn(),
  },
}));

import { notificationsApi } from "../api/notifications";
import { academicSessionsApi, classesApi, sectionsApi } from "../api/academicSetup";
import { staffApi } from "../api/staff";

const SESSION = { _id: "sess1", name: "2026" };
const CLASS = { _id: "cls1", name: "Class 10" };
const SECTION = { _id: "sec1", name: "Section A" };
const STAFF_MEMBER = { _id: "staff1", fullName: "Imran Ali" };

const COMPLETED_NOTIFICATION = {
  _id: "notif1",
  title: "PTM Reminder",
  audienceDescription: "Class 10 - Section A guardians",
  channels: ["in_app", "email"],
  status: "completed",
  createdAt: "2026-02-01T00:00:00.000Z",
};

const FAILED_NOTIFICATION = {
  _id: "notif2",
  title: "Fee due reminder",
  audienceDescription: null,
  channels: ["sms"],
  status: "failed",
  createdAt: "2026-02-02T00:00:00.000Z",
};

function renderNotifications() {
  return render(
    <MemoryRouter>
      <Notifications />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  academicSessionsApi.list.mockResolvedValue({ items: [SESSION] });
  classesApi.list.mockResolvedValue({ items: [CLASS] });
  sectionsApi.list.mockResolvedValue({ items: [SECTION] });
  staffApi.list.mockResolvedValue({ items: [STAFF_MEMBER] });
  notificationsApi.list.mockResolvedValue({
    items: [COMPLETED_NOTIFICATION, FAILED_NOTIFICATION],
    page: 1,
    totalPages: 1,
    total: 2,
  });
});

describe("Admin — notifications list", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: { role: "admin", _id: "admin1" }, isAdmin: true });
  });

  it("renders sent notifications with their audience note and channel labels", async () => {
    renderNotifications();

    expect(await screen.findByText("PTM Reminder")).toBeInTheDocument();
    expect(screen.getByText("Class 10 - Section A guardians")).toBeInTheDocument();
    expect(screen.getByText("Fee due reminder")).toBeInTheDocument();
    // "No audience note" fallback for a null audienceDescription.
    expect(screen.getByText("No audience note")).toBeInTheDocument();
  });

  it("surfaces a list-load error instead of silently showing an empty table", async () => {
    notificationsApi.list.mockReset();
    notificationsApi.list.mockRejectedValue(new Error("Network down"));
    renderNotifications();

    expect(await screen.findByText(/Couldn't load notifications: Network down/)).toBeInTheDocument();
  });

  it("calls retry-failed and reports how many deliveries were retried", async () => {
    const user = userEvent.setup();
    notificationsApi.retryFailed.mockResolvedValue({ retriedCount: 3 });
    renderNotifications();
    await screen.findByText("PTM Reminder");

    await user.click(screen.getByRole("button", { name: /retry failed/i }));

    await waitFor(() => expect(notificationsApi.retryFailed).toHaveBeenCalledTimes(1));
    expect(mockToast.success).toHaveBeenCalledWith("Retried 3 failed deliveries");
    // A successful retry refreshes the list.
    await waitFor(() => expect(notificationsApi.list).toHaveBeenCalledTimes(2));
  });

  it("reports zero retried deliveries with singular-safe wording when none were eligible", async () => {
    const user = userEvent.setup();
    notificationsApi.retryFailed.mockResolvedValue({ retriedCount: 0 });
    renderNotifications();
    await screen.findByText("PTM Reminder");

    await user.click(screen.getByRole("button", { name: /retry failed/i }));

    await waitFor(() =>
      expect(mockToast.success).toHaveBeenCalledWith("No failed deliveries were eligible for retry right now")
    );
  });
});

describe("Admin — notification detail modal", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: { role: "admin", _id: "admin1" }, isAdmin: true });
  });

  it("shows the delivery summary counts and per-recipient rows", async () => {
    const user = userEvent.setup();
    notificationsApi.getOne.mockResolvedValue({
      notification: COMPLETED_NOTIFICATION,
      deliverySummary: { pending: 0, sent: 1, delivered: 4, failed: 1 },
      recipients: [
        {
          _id: "rec1",
          recipientType: "guardian",
          channel: "email",
          destination: "parent@example.com",
          status: "delivered",
          attempts: 1,
          lastError: null,
        },
      ],
    });
    renderNotifications();

    const row = (await screen.findByText("PTM Reminder")).closest("tr");
    await user.click(within(row).getByLabelText("View delivery detail"));

    await screen.findByText("parent@example.com");
    expect(screen.getByText("4")).toBeInTheDocument(); // delivered count
    expect(screen.getByText("—")).toBeInTheDocument(); // no lastError fallback
  });

  it("shows a 'no recipients' message when none were resolved", async () => {
    const user = userEvent.setup();
    notificationsApi.getOne.mockResolvedValue({
      notification: FAILED_NOTIFICATION,
      deliverySummary: {},
      recipients: [],
    });
    renderNotifications();

    const row = (await screen.findByText("Fee due reminder")).closest("tr");
    await user.click(within(row).getByLabelText("View delivery detail"));

    expect(await screen.findByText(/No recipients were resolved/)).toBeInTheDocument();
  });
});

describe("Admin — new notification modal", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: { role: "admin", _id: "admin1" }, isAdmin: true });
  });

  it("blocks submission when no channel is selected", async () => {
    const user = userEvent.setup();
    renderNotifications();
    await screen.findByText("PTM Reminder");

    await user.click(screen.getByRole("button", { name: /new notification/i }));
    await screen.findByLabelText("Title *");

    // in_app is checked by default — uncheck it to leave zero channels.
    await user.click(screen.getByLabelText("In-app"));
    await user.type(screen.getByLabelText("Title *"), "Test");
    await user.type(screen.getByLabelText("Message *"), "Body");
    // Default audienceType is "class_section", whose session/class/section
    // <select>s carry a native `required` attribute — a real click on
    // "Send" would trip the browser's own constraint validation on those
    // (still empty here) before handleSubmit's channels check ever runs,
    // the same "native validation blocks the JS check" trap session 10's
    // notes already flagged for Fees.jsx/Tests.jsx. Submitting the form
    // directly bypasses that and exercises the JS-level check itself,
    // which is what this test is actually about.
    fireEvent.submit(screen.getByRole("button", { name: /^send$/i }).closest("form"));

    expect(await screen.findByText("Pick at least one channel")).toBeInTheDocument();
    expect(notificationsApi.create).not.toHaveBeenCalled();
  });

  it("blocks a class_section audience until session/class/section are all picked", async () => {
    const user = userEvent.setup();
    renderNotifications();
    await screen.findByText("PTM Reminder");

    await user.click(screen.getByRole("button", { name: /new notification/i }));
    await screen.findByLabelText("Title *");
    await user.type(screen.getByLabelText("Title *"), "Test");
    await user.type(screen.getByLabelText("Message *"), "Body");
    // Default audienceType is already class_section, with nothing picked.
    // Same native-`required`-vs-JS-check trap as the test above — submit
    // the form directly so this exercises handleSubmit's own audience
    // check rather than being silently intercepted by the browser's
    // constraint validation on the empty session/class/section selects.
    fireEvent.submit(screen.getByRole("button", { name: /^send$/i }).closest("form"));

    expect(await screen.findByText("Pick a session, class and section for this audience")).toBeInTheDocument();
    expect(notificationsApi.create).not.toHaveBeenCalled();
  });

  it("blocks a staff audience until at least one staff member is picked", async () => {
    const user = userEvent.setup();
    renderNotifications();
    await screen.findByText("PTM Reminder");

    await user.click(screen.getByRole("button", { name: /new notification/i }));
    await screen.findByLabelText("Title *");
    await user.type(screen.getByLabelText("Title *"), "Test");
    await user.type(screen.getByLabelText("Message *"), "Body");
    await user.selectOptions(screen.getByLabelText("Audience *"), "staff");
    await user.click(screen.getByRole("button", { name: /^send$/i }));

    expect(await screen.findByText("Pick at least one staff member")).toBeInTheDocument();
    expect(notificationsApi.create).not.toHaveBeenCalled();
  });

  it("sends a class_section notification with the correctly-shaped audience payload", async () => {
    const user = userEvent.setup();
    notificationsApi.create.mockResolvedValue({
      notification: { ...COMPLETED_NOTIFICATION, _id: "new1" },
      recipientCount: 24,
    });
    renderNotifications();
    await screen.findByText("PTM Reminder");

    await user.click(screen.getByRole("button", { name: /new notification/i }));
    await screen.findByLabelText("Title *");
    await user.type(screen.getByLabelText("Title *"), "PTM Reminder");
    await user.type(screen.getByLabelText("Message *"), "Meeting tomorrow at 9am");
    await user.selectOptions(screen.getByLabelText("Academic session *"), "sess1");
    await screen.findByText("Class 10");
    await user.selectOptions(screen.getByLabelText("Class *"), "cls1");
    await screen.findByText("Section A");
    await user.selectOptions(screen.getByLabelText("Section *"), "sec1");

    await user.click(screen.getByRole("button", { name: /^send$/i }));

    await waitFor(() => expect(notificationsApi.create).toHaveBeenCalledTimes(1));
    expect(notificationsApi.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "PTM Reminder",
        body: "Meeting tomorrow at 9am",
        channels: ["in_app"],
        audience: { type: "class_section", academicSession: "sess1", classId: "cls1", sectionId: "sec1" },
      })
    );
    expect(mockToast.success).toHaveBeenCalledWith("Sent to 24 recipients");
  });

  it("sends a staff-audience notification with the picked staffIds", async () => {
    const user = userEvent.setup();
    notificationsApi.create.mockResolvedValue({
      notification: { ...COMPLETED_NOTIFICATION, _id: "new2" },
      recipientCount: 1,
    });
    renderNotifications();
    await screen.findByText("PTM Reminder");

    await user.click(screen.getByRole("button", { name: /new notification/i }));
    await screen.findByLabelText("Title *");
    await user.type(screen.getByLabelText("Title *"), "Staff meeting");
    await user.type(screen.getByLabelText("Message *"), "Please attend");
    await user.selectOptions(screen.getByLabelText("Audience *"), "staff");
    await screen.findByText("Imran Ali");
    await user.click(screen.getByText("Imran Ali"));

    await user.click(screen.getByRole("button", { name: /^send$/i }));

    await waitFor(() => expect(notificationsApi.create).toHaveBeenCalledTimes(1));
    expect(notificationsApi.create).toHaveBeenCalledWith(
      expect.objectContaining({ audience: { type: "staff", staffIds: ["staff1"] } })
    );
    expect(mockToast.success).toHaveBeenCalledWith("Sent to 1 recipient");
  });

  it("surfaces a create error instead of silently closing the modal", async () => {
    const user = userEvent.setup();
    notificationsApi.create.mockRejectedValue(new Error("SMTP not configured"));
    renderNotifications();
    await screen.findByText("PTM Reminder");

    await user.click(screen.getByRole("button", { name: /new notification/i }));
    await screen.findByLabelText("Title *");
    await user.type(screen.getByLabelText("Title *"), "Test");
    await user.type(screen.getByLabelText("Message *"), "Body");
    await user.selectOptions(screen.getByLabelText("Audience *"), "all_guardians");

    await user.click(screen.getByRole("button", { name: /^send$/i }));

    expect(await screen.findByText("SMTP not configured")).toBeInTheDocument();
  });
});

describe("Non-admin — my notifications feed", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: { role: "staff", _id: "staff1" }, isAdmin: false });
  });

  it("renders the logged-in user's own notifications, newest first as returned by the API", async () => {
    notificationsApi.mine.mockResolvedValue({
      items: [
        {
          _id: "rec1",
          status: "delivered",
          sentAt: "2026-02-03T00:00:00.000Z",
          notification: { title: "Staff meeting", body: "Please attend" },
        },
      ],
    });
    renderNotifications();

    expect(await screen.findByText("Staff meeting")).toBeInTheDocument();
    expect(screen.getByText("Please attend")).toBeInTheDocument();
    // The admin-only "New notification" action must not render for a
    // non-admin — this feed is read-only.
    expect(screen.queryByRole("button", { name: /new notification/i })).not.toBeInTheDocument();
  });

  it("shows an empty-state message rather than a blank page with no notifications", async () => {
    notificationsApi.mine.mockResolvedValue({ items: [] });
    renderNotifications();

    expect(await screen.findByText("No notifications yet.")).toBeInTheDocument();
  });

  it("surfaces a load error via toast rather than crashing", async () => {
    notificationsApi.mine.mockRejectedValue(new Error("Session expired"));
    renderNotifications();

    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith("Session expired"));
  });
});
