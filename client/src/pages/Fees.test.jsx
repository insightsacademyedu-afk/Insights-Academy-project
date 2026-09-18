import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Fees from "./Fees";

// Fees.jsx pulls in AppLayout -> Sidebar/Topbar/MobileNav, all of which
// call useAuth() and (for Sidebar/MobileNav) render <NavLink>, so this
// needs both a router and a mocked auth context — same requirement
// ProtectedRoute.test.jsx already established for this codebase.
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
  studentsApi: { list: vi.fn() },
}));

vi.mock("../api/fees", () => ({
  feesApi: {
    listInvoices: vi.fn(),
    getInvoice: vi.fn(),
    createInvoice: vi.fn(),
    bulkGenerateInvoices: vi.fn(),
    recordPayment: vi.fn(),
    waiveInvoice: vi.fn(),
    studentSummary: vi.fn(),
  },
}));

import { feesApi } from "../api/fees";
import { studentsApi } from "../api/students";
import { academicSessionsApi, classesApi, sectionsApi } from "../api/academicSetup";

const SESSION = { _id: "sess1", name: "2026", isCurrent: true };

const UNPAID_INVOICE = {
  _id: "inv1",
  student: { fullName: "Amina Khan", admissionNumber: "A-001" },
  period: "2026-01",
  invoiceType: "tuition",
  totalAmount: 5000,
  amountPaid: 1000,
  dueDate: "2026-02-01T00:00:00.000Z",
  status: "unpaid",
};

const WAIVED_INVOICE = {
  _id: "inv2",
  student: { fullName: "Bilal Ahmed", admissionNumber: "A-002" },
  period: "2026-01",
  invoiceType: "tuition",
  totalAmount: 3000,
  amountPaid: 500,
  dueDate: "2026-02-01T00:00:00.000Z",
  status: "waived",
};

const PAID_INVOICE = {
  _id: "inv3",
  student: { fullName: "Sara Malik", admissionNumber: "A-003" },
  period: "2026-01",
  invoiceType: "tuition",
  totalAmount: 2000,
  amountPaid: 2000,
  dueDate: "2026-02-01T00:00:00.000Z",
  status: "paid",
};

function renderFees() {
  return render(
    <MemoryRouter>
      <Fees />
    </MemoryRouter>
  );
}

// Several row actions and their modal's submit button share the exact same
// label (e.g. "Record payment" both opens the modal and submits it), so a
// plain name-matched query is ambiguous once the modal is open. Every
// <button> defaults its DOM `.type` to "submit" per the HTML spec whether
// or not it sits in a form, so that can't disambiguate them either — the
// modal's own submit button is simply the one mounted last (it's a nested
// child component rendered after the row action that opens it).
function submitButton(name) {
  const matches = screen.getAllByRole("button", { name });
  return matches[matches.length - 1];
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: { role: "admin", _id: "admin1" }, isAdmin: true });
  academicSessionsApi.list.mockResolvedValue({ items: [SESSION] });
  classesApi.list.mockResolvedValue({ items: [{ _id: "class1", name: "Class 1" }] });
  sectionsApi.list.mockResolvedValue({ items: [{ _id: "section1", name: "A" }] });
  feesApi.listInvoices.mockResolvedValue({
    items: [UNPAID_INVOICE, WAIVED_INVOICE],
    page: 1,
    totalPages: 1,
    total: 2,
  });
  studentsApi.list.mockResolvedValue({ items: [] });
});

describe("Fees list", () => {
  it("renders invoices with a computed outstanding column, and hides it for a waived invoice", async () => {
    renderFees();

    expect(await screen.findByText("Amina Khan")).toBeInTheDocument();
    expect(screen.getByText("Bilal Ahmed")).toBeInTheDocument();

    // 5000 - 1000 = 4000 outstanding for the unpaid invoice.
    expect(screen.getByText(/4,000/)).toBeInTheDocument();

    // Waived invoice never shows a numeric outstanding figure, even
    // though it has an unpaid balance (500 of 3000) — matches the
    // backend's own "waived is administratively excused" behavior.
    const waivedRow = screen.getByText("Bilal Ahmed").closest("tr");
    expect(within(waivedRow).getByText("—")).toBeInTheDocument();
  });

  it("surfaces a list-load error instead of silently showing an empty table", async () => {
    feesApi.listInvoices.mockReset();
    feesApi.listInvoices.mockRejectedValue(new Error("Network down"));
    renderFees();

    expect(await screen.findByText(/Couldn't load invoices: Network down/)).toBeInTheDocument();
  });
});

describe("New invoice modal", () => {
  it("blocks submission until a student is picked", async () => {
    const user = userEvent.setup();
    renderFees();
    await screen.findByText("Amina Khan");

    await user.click(screen.getByRole("button", { name: /new invoice/i }));

    // Fill every *other* required field so the browser's own HTML5
    // validation doesn't block the submit before handleSubmit's
    // explicit "pick a student first" check ever runs.
    await user.selectOptions(screen.getByRole("combobox", { name: /academic session/i }), "sess1");
    await user.type(screen.getByPlaceholderText("e.g. 2026-01"), "2026-02");
    const dueDateInputs = document.querySelectorAll('input[type="date"]');
    await user.type(dueDateInputs[0], "2026-03-01");

    await user.click(screen.getByRole("button", { name: /^create invoice$/i }));

    expect(await screen.findByText("Pick a student first")).toBeInTheDocument();
    expect(feesApi.createInvoice).not.toHaveBeenCalled();
  });

  it("omits blank override fields from the request body instead of sending them as empty strings", async () => {
    const user = userEvent.setup();
    studentsApi.list.mockResolvedValue({
      items: [{ _id: "stu1", fullName: "Zara Iqbal", admissionNumber: "A-010", feeDetails: { monthlyTuition: 4000 } }],
    });
    feesApi.createInvoice.mockResolvedValue({ invoice: { _id: "new1" } });

    renderFees();
    await screen.findByText("Amina Khan");
    await user.click(screen.getByRole("button", { name: /new invoice/i }));

    // Pick the student via the debounced search-select.
    await user.type(screen.getByPlaceholderText(/search by name or admission/i), "Zara");
    await screen.findByText("Zara Iqbal");
    await user.click(screen.getByText("Zara Iqbal"));

    await user.selectOptions(screen.getByRole("combobox", { name: /academic session/i }), "sess1");
    await user.type(screen.getByPlaceholderText("e.g. 2026-01"), "2026-02");
    const dueDateInputs = document.querySelectorAll('input[type="date"]');
    await user.type(dueDateInputs[0], "2026-03-01");

    // Turn on overrides but only fill in one of the six fields — the
    // rest must be omitted entirely from the POST body, not sent as "".
    await user.click(screen.getByLabelText(/override amounts/i));
    await user.type(screen.getByPlaceholderText("4000"), "3500");

    await user.click(screen.getByRole("button", { name: /^create invoice$/i }));

    await waitFor(() => expect(feesApi.createInvoice).toHaveBeenCalledTimes(1));
    const body = feesApi.createInvoice.mock.calls[0][0];
    expect(body.student).toBe("stu1");
    expect(body.overrides).toEqual({ monthlyTuition: "3500" });
  });
});

describe("Bulk invoice generation", () => {
  it("generates an exam fee with a shared amount for the selected class", async () => {
    const user = userEvent.setup();
    feesApi.bulkGenerateInvoices.mockResolvedValue({ createdCount: 2, skippedCount: 0, created: [], skipped: [] });
    renderFees();
    await screen.findByText("Amina Khan");

    await user.click(screen.getByRole("button", { name: /bulk generate/i }));
    await user.selectOptions(screen.getByLabelText("Academic session *"), "sess1");
    await waitFor(() => expect(classesApi.list).toHaveBeenCalled());
    await user.selectOptions(screen.getByLabelText("Class *"), "class1");
    await waitFor(() => expect(sectionsApi.list).toHaveBeenCalled());
    await user.selectOptions(screen.getByLabelText("Section *"), "section1");
    await user.selectOptions(screen.getByLabelText("Invoice type *"), "exam");
    await user.type(screen.getByLabelText("Amount for each student"), "1500");
    await user.type(screen.getByPlaceholderText("e.g. 2026-01"), "Annual Exam 2026");
    await user.type(document.querySelector('input[type="date"]'), "2026-06-01");
    await user.click(screen.getByRole("button", { name: /^generate$/i }));

    await waitFor(() => expect(feesApi.bulkGenerateInvoices).toHaveBeenCalledTimes(1));
    expect(feesApi.bulkGenerateInvoices).toHaveBeenCalledWith({
      academicSession: "sess1",
      class: "class1",
      section: "section1",
      invoiceType: "exam",
      amountOverride: "1500",
      period: "Annual Exam 2026",
      dueDate: "2026-06-01",
    });
  });
});

describe("Invoice detail modal", () => {
  it("shows Waive and Record payment actions for an unpaid invoice", async () => {
    const user = userEvent.setup();
    feesApi.getInvoice.mockResolvedValue({ invoice: UNPAID_INVOICE, payments: [] });
    renderFees();

    const row = (await screen.findByText("Amina Khan")).closest("tr");
    await user.click(within(row).getByLabelText("View invoice"));

    expect(await screen.findByText("Waive")).toBeInTheDocument();
    expect(screen.getByText("Record payment")).toBeInTheDocument();
  });

  it("hides Waive and Record payment for an already-paid invoice", async () => {
    const user = userEvent.setup();
    feesApi.listInvoices.mockResolvedValue({ items: [PAID_INVOICE], page: 1, totalPages: 1, total: 1 });
    feesApi.getInvoice.mockResolvedValue({ invoice: PAID_INVOICE, payments: [] });
    renderFees();

    const row = (await screen.findByText("Sara Malik")).closest("tr");
    await user.click(within(row).getByLabelText("View invoice"));

    await screen.findByText(/Invoice — Sara Malik/);
    expect(screen.queryByText("Waive")).not.toBeInTheDocument();
    expect(screen.queryByText("Record payment")).not.toBeInTheDocument();
  });

  it("records a payment with the entered amount/method and refreshes the invoice", async () => {
    const user = userEvent.setup();
    feesApi.getInvoice.mockResolvedValue({ invoice: UNPAID_INVOICE, payments: [] });
    feesApi.recordPayment.mockResolvedValue({
      invoice: { ...UNPAID_INVOICE, amountPaid: 2000, status: "partially_paid" },
      payment: { receiptNumber: "RCPT-2026-00042" },
    });
    renderFees();

    const row = (await screen.findByText("Amina Khan")).closest("tr");
    await user.click(within(row).getByLabelText("View invoice"));
    await user.click(await screen.findByText("Record payment"));

    const amountInput = screen.getByRole("spinbutton");
    await user.type(amountInput, "1000");
    await user.click(submitButton(/^record payment$/i));

    await waitFor(() => expect(feesApi.recordPayment).toHaveBeenCalledTimes(1));
    expect(feesApi.recordPayment).toHaveBeenCalledWith(
      expect.objectContaining({ invoice: "inv1", amount: 1000, method: "cash" })
    );
    expect(mockToast.success).toHaveBeenCalledWith(expect.stringContaining("RCPT-2026-00042"));
  });

  it("waives an invoice with an optional reason", async () => {
    const user = userEvent.setup();
    feesApi.getInvoice.mockResolvedValue({ invoice: UNPAID_INVOICE, payments: [] });
    feesApi.waiveInvoice.mockResolvedValue({ invoice: { ...UNPAID_INVOICE, status: "waived" } });
    renderFees();

    const row = (await screen.findByText("Amina Khan")).closest("tr");
    await user.click(within(row).getByLabelText("View invoice"));
    await user.click(await screen.findByText("Waive"));

    await user.type(screen.getByPlaceholderText(/financial hardship/i), "Scholarship exception");
    await user.click(screen.getByRole("button", { name: /^waive invoice$/i }));

    await waitFor(() => expect(feesApi.waiveInvoice).toHaveBeenCalledTimes(1));
    expect(feesApi.waiveInvoice).toHaveBeenCalledWith("inv1", { reason: "Scholarship exception" });
  });

  it("surfaces a rejected payment (e.g. overpayment) as a readable error, not a crash", async () => {
    const user = userEvent.setup();
    feesApi.getInvoice.mockResolvedValue({ invoice: UNPAID_INVOICE, payments: [] });
    feesApi.recordPayment.mockRejectedValue(new Error("Payment exceeds remaining balance"));
    renderFees();

    const row = (await screen.findByText("Amina Khan")).closest("tr");
    await user.click(within(row).getByLabelText("View invoice"));
    await user.click(await screen.findByText("Record payment"));

    await user.type(screen.getByRole("spinbutton"), "9999");
    await user.click(submitButton(/^record payment$/i));

    expect(await screen.findByText("Payment exceeds remaining balance")).toBeInTheDocument();
  });
});

it('allows a negative adjustment against a paid invoice',async()=>{
 const user=userEvent.setup();
 feesApi.listInvoices.mockResolvedValue({items:[PAID_INVOICE],page:1,totalPages:1,total:1});
 feesApi.getInvoice.mockResolvedValue({invoice:PAID_INVOICE,payments:[]});
 feesApi.recordPayment.mockResolvedValue({payment:{receiptNumber:'ADJUST-1'}});
 renderFees();
 const row=(await screen.findByText('Sara Malik')).closest('tr');
 await user.click(within(row).getByLabelText('View invoice'));
 await user.click(await screen.findByRole('button',{name:'Adjust payment'}));
 const amount=screen.getByRole('spinbutton');
 expect(amount).toHaveAttribute('min','-2000');
 await user.type(amount,'-0.10');
 await user.click(submitButton(/^record payment$/i));
 await waitFor(()=>expect(feesApi.recordPayment).toHaveBeenCalledWith(expect.objectContaining({invoice:'inv3',amount:-0.1,method:'adjustment'})));
});
