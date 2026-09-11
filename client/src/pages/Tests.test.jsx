import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Tests from "./Tests";

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
  subjectsApi: { list: vi.fn() },
}));

vi.mock("../api/staff", () => ({
  staffApi: { list: vi.fn() },
}));

vi.mock("../api/teacherAssignments", () => ({
  teacherAssignmentsApi: { mine: vi.fn(), list: vi.fn() },
}));

vi.mock("../api/dashboard", () => ({
  fetchGradeDistribution: vi.fn(),
}));

vi.mock("../api/tests", () => ({
  testsApi: {
    list: vi.fn(),
    getOne: vi.fn(),
    create: vi.fn(),
    roster: vi.fn(),
    enterMarks: vi.fn(),
    finalize: vi.fn(),
    amendMark: vi.fn(),
  },
}));

import { testsApi } from "../api/tests";
import { academicSessionsApi, classesApi, sectionsApi, subjectsApi } from "../api/academicSetup";
import { staffApi } from "../api/staff";
import { teacherAssignmentsApi } from "../api/teacherAssignments";
import { fetchGradeDistribution } from "../api/dashboard";

const SESSION = { _id: "sess1", name: "2026", isCurrent: true };
const CLASS = { _id: "class1", name: "Class 9" };
const SECTION = { _id: "sect1", name: "A" };
const SUBJECT = { _id: "subj1", name: "Mathematics", code: "MATH" };
const TEACHER = { _id: "staff1", fullName: "Mr. Tariq" };

const ASSIGNMENT = {
  _id: "assign1",
  academicSession: SESSION,
  class: CLASS,
  section: SECTION,
  subject: SUBJECT,
};

const DRAFT_TEST = {
  _id: "test1",
  title: "Mid-term Mathematics",
  class: "class1",
  section: "sect1",
  subject: "subj1",
  academicSession: "sess1",
  createdBy: "staff1",
  testDate: "2026-03-01T00:00:00.000Z",
  passingMarks: 33,
  maxMarks: 100,
  status: "draft",
};

const FINALIZED_TEST = { ...DRAFT_TEST, _id: "test2", status: "finalized" };

function renderTests() {
  return render(
    <MemoryRouter>
      <Tests />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  academicSessionsApi.list.mockResolvedValue({ items: [SESSION] });
  classesApi.list.mockResolvedValue({ items: [CLASS] });
  sectionsApi.list.mockResolvedValue({ items: [SECTION] });
  subjectsApi.list.mockResolvedValue({ items: [SUBJECT] });
  staffApi.list.mockResolvedValue({ items: [TEACHER] });
  teacherAssignmentsApi.mine.mockResolvedValue({ items: [ASSIGNMENT] });
  fetchGradeDistribution.mockResolvedValue({
    totalStudents: 2,
    passCount: 1,
    failCount: 1,
    averageMarks: 55,
  });
  testsApi.list.mockResolvedValue({ items: [DRAFT_TEST], page: 1, totalPages: 1, total: 1 });
});

describe("Teacher with no assignments", () => {
  it("disables New test and explains why, instead of opening a form that could only ever 403", async () => {
    mockUseAuth.mockReturnValue({ isAdmin: false, user: { role: "staff", staffId: "staff1" } });
    teacherAssignmentsApi.mine.mockResolvedValue({ items: [] });
    testsApi.list.mockResolvedValue({ items: [], page: 1, totalPages: 1, total: 0 });

    renderTests();

    expect(await screen.findByText(/no class assignments yet/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /new test/i })).toBeDisabled();
  });
});

describe("Teacher creating a test", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ isAdmin: false, user: { role: "staff", staffId: "staff1" } });
  });

  it("derives class/section/subject/session from the picked assignment as one atomic choice", async () => {
    const user = userEvent.setup();
    testsApi.create.mockResolvedValue({ test: { _id: "new1" } });
    renderTests();

    await user.click(await screen.findByRole("button", { name: /new test/i }));

    const assignmentSelect = screen.getByRole("combobox", { name: /class \/ section \/ subject/i });
    await user.selectOptions(assignmentSelect, "assign1");
    await user.type(screen.getByPlaceholderText(/mid-term mathematics/i), "Unit Test 1");
    await user.type(screen.getByRole("spinbutton", { name: /max marks/i }), "50");
    const dateInputs = document.querySelectorAll('input[type="date"]');
    await user.type(dateInputs[0], "2026-04-01");

    await user.click(screen.getByRole("button", { name: /^create test$/i }));

    await waitFor(() => expect(testsApi.create).toHaveBeenCalledTimes(1));
    const body = testsApi.create.mock.calls[0][0];
    expect(body.class).toBe("class1");
    expect(body.section).toBe("sect1");
    expect(body.subject).toBe("subj1");
    expect(body.academicSession).toBe("sess1");
    expect(body.createdBy).toBeUndefined();
  });
});

describe("Admin creating a test", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ isAdmin: true, user: { role: "admin" } });
  });

  it("sends the explicit createdBy plus the dependent-dropdown selections", async () => {
    const user = userEvent.setup();
    testsApi.create.mockResolvedValue({ test: { _id: "new2" } });
    renderTests();

    await user.click(await screen.findByRole("button", { name: /new test/i }));

    await user.selectOptions(screen.getByRole("combobox", { name: /teacher/i }), "staff1");
    await user.selectOptions(screen.getByRole("combobox", { name: /academic session/i }), "sess1");
    // These fields are marked `required`, so their accessible name
    // includes the visible " *" suffix — match loosely rather than
    // anchoring on the exact label text.
    await user.selectOptions(await screen.findByRole("combobox", { name: /^class/i }), "class1");
    await user.selectOptions(await screen.findByRole("combobox", { name: /^section/i }), "sect1");
    await user.selectOptions(screen.getByRole("combobox", { name: /^subject/i }), "subj1");
    await user.type(screen.getByPlaceholderText(/mid-term mathematics/i), "Final Exam");
    await user.type(screen.getByRole("spinbutton", { name: /max marks/i }), "100");
    const dateInputs = document.querySelectorAll('input[type="date"]');
    await user.type(dateInputs[0], "2026-05-01");

    await user.click(screen.getByRole("button", { name: /^create test$/i }));

    await waitFor(() => expect(testsApi.create).toHaveBeenCalledTimes(1));
    const body = testsApi.create.mock.calls[0][0];
    expect(body).toMatchObject({
      createdBy: "staff1",
      academicSession: "sess1",
      class: "class1",
      section: "sect1",
      subject: "subj1",
      title: "Final Exam",
      maxMarks: 100,
    });
  });
});

describe("Test detail — draft workflow", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ isAdmin: true, user: { role: "admin" } });
    testsApi.getOne.mockResolvedValue({ test: DRAFT_TEST, results: [] });
  });

  it("disables Finalize until at least one mark has been entered", async () => {
    const user = userEvent.setup();
    renderTests();

    const row = (await screen.findByText("Mid-term Mathematics")).closest("tr");
    await user.click(within(row).getByLabelText("View test"));

    await screen.findByText("Mid-term Mathematics", { selector: "h2" });
    expect(screen.getByRole("button", { name: /finalize/i })).toBeDisabled();
  });

  it("submits only rows with a mark entered, not the whole blank roster", async () => {
    const user = userEvent.setup();
    testsApi.roster.mockResolvedValue({
      roster: [
        { student: "stu1", fullName: "Amina Khan", admissionNumber: "A-001", rollNumber: 1 },
        { student: "stu2", fullName: "Bilal Ahmed", admissionNumber: "A-002", rollNumber: 2 },
      ],
    });
    testsApi.enterMarks.mockResolvedValue({ savedCount: 1 });

    renderTests();
    const row = (await screen.findByText("Mid-term Mathematics")).closest("tr");
    await user.click(within(row).getByLabelText("View test"));
    await user.click(await screen.findByText("Enter marks"));

    await screen.findByText("Amina Khan");
    const markInputs = screen.getAllByRole("spinbutton");
    await user.type(markInputs[0], "78"); // only Amina gets a mark

    await user.click(screen.getByRole("button", { name: /^save marks$/i }));

    await waitFor(() => expect(testsApi.enterMarks).toHaveBeenCalledTimes(1));
    const [, body] = testsApi.enterMarks.mock.calls[0];
    expect(body.entries).toEqual([{ student: "stu1", marksObtained: 78, remarks: "" }]);
  });
});

describe("Test detail — finalized workflow", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ isAdmin: true, user: { role: "admin" } });
    testsApi.list.mockResolvedValue({ items: [FINALIZED_TEST], page: 1, totalPages: 1, total: 1 });
  });

  it("hides Enter marks/Finalize once finalized, and amending requires a reason", async () => {
    const user = userEvent.setup();
    testsApi.getOne.mockResolvedValue({
      test: FINALIZED_TEST,
      results: [
        {
          _id: "res1",
          student: { _id: "stu1", fullName: "Amina Khan", admissionNumber: "A-001" },
          marksObtained: 78,
          summary: { percentage: 78, grade: "B", passed: true },
          amendments: [],
        },
      ],
    });
    testsApi.amendMark.mockResolvedValue({});

    renderTests();
    const row = (await screen.findByText("Mid-term Mathematics")).closest("tr");
    await user.click(within(row).getByLabelText("View test"));

    await screen.findByText("Amina Khan");
    expect(screen.queryByText("Enter marks")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /finalize/i })).not.toBeInTheDocument();

    await user.click(screen.getByText("Amend"));
    // "Save amendment" is disabled until the required reason is filled —
    // exercised by attempting submit with reason empty first.
    await user.click(screen.getByRole("button", { name: /^save amendment$/i }));
    expect(testsApi.amendMark).not.toHaveBeenCalled();

    await user.clear(screen.getByRole("spinbutton"));
    await user.type(screen.getByRole("spinbutton"), "82");
    await user.type(screen.getByRole("textbox", { name: /reason/i }), "Re-checked paper");
    await user.click(screen.getByRole("button", { name: /^save amendment$/i }));

    await waitFor(() => expect(testsApi.amendMark).toHaveBeenCalledTimes(1));
    expect(testsApi.amendMark).toHaveBeenCalledWith("test2", {
      student: "stu1",
      newMarks: 82,
      reason: "Re-checked paper",
    });
  });
});
