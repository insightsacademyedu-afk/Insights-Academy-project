import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Students from "./Students";

// Same AppLayout -> Sidebar/Topbar/MobileNav requirement every page test
// in this codebase already deals with (see Fees.test.jsx/Tests.test.jsx/
// Notifications.test.jsx).
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

vi.mock("../api/students", () => ({
  studentsApi: {
    list: vi.fn(),
    getOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    enroll: vi.fn(),
  },
}));

import { studentsApi } from "../api/students";
import { academicSessionsApi, classesApi, sectionsApi } from "../api/academicSetup";

const SESSION = { _id: "sess1", name: "2026", isCurrent: true };
const CLASS = { _id: "class1", name: "Class 9" };
const SECTION = { _id: "sec1", name: "A" };

const ADMIN_STUDENT = {
  _id: "stu1",
  fullName: "Amina Khan",
  admissionNumber: "A-001",
  gender: "female",
  dob: "2012-03-04T00:00:00.000Z",
  status: "active",
  guardian: { fullName: "Tariq Khan", primaryPhone: "0300-1111111" },
};

const TEACHER_STUDENT = {
  _id: "stu2",
  fullName: "Bilal Ahmed",
  admissionNumber: "A-002",
  gender: "male",
  dob: "2011-06-10T00:00:00.000Z",
  status: "active",
  // Deliberately no `guardian` key at all — matches
  // studentController.list's teacher branch, which never populates it
  // (Students.jsx hides the whole column for a non-admin rather than
  // rendering broken data, so this shape is what a teacher's response
  // actually looks like, not an oversight).
};

function renderStudents() {
  return render(
    <MemoryRouter>
      <Students />
    </MemoryRouter>
  );
}

// Row actions and their modal's own submit button don't collide by label
// here the way Fees.jsx's "Record payment" does, but the same "last
// mounted match wins" helper is kept for anything that ever does.
function submitButton(name) {
  const matches = screen.getAllByRole("button", { name });
  return matches[matches.length - 1];
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: { role: "admin", _id: "admin1" }, isAdmin: true });
  academicSessionsApi.list.mockResolvedValue({ items: [SESSION] });
  classesApi.list.mockResolvedValue({ items: [CLASS] });
  sectionsApi.list.mockResolvedValue({ items: [SECTION] });
  studentsApi.list.mockResolvedValue({
    items: [ADMIN_STUDENT],
    page: 1,
    totalPages: 1,
    total: 1,
  });
});

describe("Students list — admin", () => {
  it("renders students with the guardian column", async () => {
    renderStudents();

    expect(await screen.findByText("Amina Khan")).toBeInTheDocument();
    expect(screen.getByText("A-001")).toBeInTheDocument();
    expect(screen.getByText("Tariq Khan")).toBeInTheDocument();
  });

  it("filters the student list by class and then section", async () => {
    const user = userEvent.setup();
    renderStudents();
    await screen.findByText("Amina Khan");

    const classFilter = await screen.findByLabelText("Class filter");
    await waitFor(() => expect(screen.getByRole("option", { name: "Class 9" })).toBeInTheDocument());
    await user.selectOptions(classFilter, "class1");
    await waitFor(() => expect(studentsApi.list).toHaveBeenCalledWith(expect.objectContaining({ class: "class1" })));

    const sectionFilter = screen.getByLabelText("Section filter");
    await waitFor(() => expect(screen.getByRole("option", { name: "A" })).toBeInTheDocument());
    await user.selectOptions(sectionFilter, "sec1");
    await waitFor(() =>
      expect(studentsApi.list).toHaveBeenCalledWith(expect.objectContaining({ class: "class1", section: "sec1" }))
    );
  });

  it("surfaces a list-load error instead of silently showing an empty table", async () => {
    studentsApi.list.mockReset();
    studentsApi.list.mockRejectedValue(new Error("Network down"));
    renderStudents();

    expect(await screen.findByText(/Couldn't load students: Network down/)).toBeInTheDocument();
  });
});

describe("Students list — teacher (non-admin)", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: { role: "staff", _id: "staff1" }, isAdmin: false });
    studentsApi.list.mockResolvedValue({
      items: [TEACHER_STUDENT],
      page: 1,
      totalPages: 1,
      total: 1,
    });
  });

  it("hides the guardian column and every admin-only action", async () => {
    renderStudents();

    expect(await screen.findByText("Bilal Ahmed")).toBeInTheDocument();
    expect(screen.queryByText("Tariq Khan")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /new student/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Edit")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Delete")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Enroll or transfer")).not.toBeInTheDocument();
    // View is still available to every role.
    expect(screen.getByLabelText("View")).toBeInTheDocument();
  });

  it("still shows fee data as absent (—) rather than throwing when viewing a student with no fee details", async () => {
    renderStudents();
    await screen.findByText("Bilal Ahmed");
    studentsApi.getOne.mockResolvedValue({ student: TEACHER_STUDENT, currentAssignment: null });

    await userEvent.click(screen.getByLabelText("View"));

    expect(await screen.findByText("Not enrolled in any active class/section yet.")).toBeInTheDocument();
    // No "Fee structure" section at all for a non-admin viewer.
    expect(screen.queryByText("Fee structure")).not.toBeInTheDocument();
  });
});

describe("New student form", () => {
  it("blocks submission when the enrollment section is incomplete", async () => {
    renderStudents();
    await screen.findByText("Amina Khan");

    await userEvent.click(screen.getByRole("button", { name: /new student/i }));
    await screen.findByLabelText("Full name *");

    await userEvent.type(screen.getByLabelText("Full name *"), "New Student");
    await userEvent.type(screen.getByLabelText("Date of birth *"), "2013-01-01");
    await userEvent.type(screen.getByLabelText("Guardian name *"), "Some Guardian");
    await userEvent.type(screen.getByLabelText("Primary phone *"), "0300-0000000");

    // Enrollment class and section are left blank.

    // The enrollment session/class/section fields all carry a
    // native HTML `required` attribute, so a real click on "Create &
    // enroll" would trip the browser's own constraint validation on those
    // before handleSubmit's own JS check ever ran — the same trap
    // Notifications.test.jsx's session-11 fix documents for its
    // audience-required selects. Submitting the form directly exercises
    // the JS-level check this test is actually about.
    fireEvent.submit(submitButton(/create & enroll/i).closest("form"));

    expect(
      await screen.findByText("Session, class and section are all required to enroll a new student.")
    ).toBeInTheDocument();
    expect(studentsApi.create).not.toHaveBeenCalled();
  });

  it("creates a student with a nested guardian and enrollment payload", async () => {
    studentsApi.create.mockResolvedValue({ _id: "new1" });
    renderStudents();
    await screen.findByText("Amina Khan");

    await userEvent.click(screen.getByRole("button", { name: /new student/i }));
    await screen.findByLabelText("Full name *");

    await userEvent.type(screen.getByLabelText("Full name *"), "New Student");
    await userEvent.type(screen.getByLabelText("Date of birth *"), "2013-01-01");
    await userEvent.type(screen.getByLabelText("Guardian name *"), "Some Guardian");
    await userEvent.type(screen.getByLabelText("Primary phone *"), "0300-0000000");

    const monthlyTuition = screen.getByLabelText("Monthly tuition");
    expect(monthlyTuition).toHaveValue(null);
    await userEvent.type(monthlyTuition, "4000");
    expect(monthlyTuition).toHaveValue(4000);

    // Session defaults to the current session already, per
    // emptyStudentForm/StudentFormModal's own reset effect — only class,
    // and section need picking.
    await userEvent.selectOptions(screen.getByLabelText("Class *"), "class1");
    await userEvent.selectOptions(screen.getByLabelText("Section *"), "sec1");

    await userEvent.click(submitButton(/create & enroll/i));

    expect(studentsApi.create).toHaveBeenCalledTimes(1);
    const body = studentsApi.create.mock.calls[0][0];
    expect(body.fullName).toBe("New Student");
    expect(body.guardian).toMatchObject({ fullName: "Some Guardian", primaryPhone: "0300-0000000" });
    expect(body.feeDetails).toMatchObject({
      monthlyTuition: 4000,
      admissionFee: 0,
      examFee: 0,
      otherFee: 0,
      discount: 0,
      scholarship: 0,
    });
    expect(body.enrollment).toMatchObject({
      academicSession: "sess1",
      class: "class1",
      section: "sec1",
    });
    expect(body.admissionNumber).toBe("");
  });
});

describe("Edit student", () => {
  it("hides the enrollment section entirely, matching the backend's separate enroll endpoint", async () => {
    renderStudents();
    await screen.findByText("Amina Khan");

    await userEvent.click(screen.getByLabelText("Edit"));
    await screen.findByLabelText("Full name *");

    expect(screen.queryByText("Enrollment")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Roll number *")).not.toBeInTheDocument();
    // Editing existing student does show the Status field, unlike create.
    expect(screen.getByLabelText("Status")).toBeInTheDocument();
  });

  it("submits an update without an enrollment key in the body", async () => {
    studentsApi.update.mockResolvedValue({});
    renderStudents();
    await screen.findByText("Amina Khan");

    await userEvent.click(screen.getByLabelText("Edit"));
    await screen.findByLabelText("Full name *");
    await userEvent.click(submitButton(/save changes/i));

    expect(studentsApi.update).toHaveBeenCalledTimes(1);
    const [id, body] = studentsApi.update.mock.calls[0];
    expect(id).toBe("stu1");
    expect(body.enrollment).toBeUndefined();
  });
});

describe("Enroll / transfer", () => {
  it("submits the picked session/class/section and lets the server assign the roll number", async () => {
    studentsApi.enroll.mockResolvedValue({});
    renderStudents();
    await screen.findByText("Amina Khan");

    await userEvent.click(screen.getByLabelText("Enroll or transfer"));
    await screen.findByText(/Enroll \/ transfer — Amina Khan/);

    await userEvent.selectOptions(screen.getByLabelText("Class *"), "class1");
    await userEvent.selectOptions(screen.getByLabelText("Section *"), "sec1");

    await userEvent.click(screen.getByRole("button", { name: /^enroll$/i }));

    expect(studentsApi.enroll).toHaveBeenCalledWith("stu1", {
      academicSession: "sess1",
      class: "class1",
      section: "sec1",
    });
  });
});

describe("Archive student", () => {
  it("requires an archive reason and current admin password", async () => {
    studentsApi.remove.mockResolvedValue({ message: "Archived" });
    renderStudents();
    await screen.findByText("Amina Khan");

    await userEvent.click(screen.getByLabelText("Archive"));
    expect(screen.getByText(/financial history is preserved/i)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/Reason/), "Student left academy");
    await userEvent.type(screen.getByLabelText(/Current admin password/), "Password123!");

    // The row's own icon action is also accessibly named "Delete"
    // (aria-label="Delete"), colliding with ConfirmDialog's default
    // confirmLabel — same collision class Fees.test.jsx's submitButton
    // helper already exists for; reused here rather than duplicated.
    await userEvent.click(submitButton(/^archive$/i));

    // handleDelete routes a rejected remove() through toast.error, not an
    // inline error element — matches every other list-page delete flow in
    // this codebase (no page renders delete failures inline).
    await vi.waitFor(() => {
      expect(studentsApi.remove).toHaveBeenCalledWith("stu1", {
        adminPassword: "Password123!",
        reason: "Student left academy",
      });
      expect(mockToast.success).toHaveBeenCalledWith("Student archived");
    });
  });
});
