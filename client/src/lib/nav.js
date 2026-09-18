import {
  KeyRound,
  ArchiveRestore,
  LayoutDashboard,
  CalendarRange,
  LayoutGrid,
  BookOpen,
  IdCard,
  Users,
  GraduationCap,
  Wallet,
  ClipboardList,
  Receipt,
  FileBarChart,
} from "lucide-react";

// `phase` documents which frontend build phase wires this module to the
// real API — see client/PROGRESS.md. Modules beyond the current phase
// still appear in the nav (so the app's shape is visible end-to-end) but
// route to a placeholder page instead of a working screen.
export const NAV_SECTIONS = [
  { label: "Account", items: [{ to: "/account", label: "My account", icon: KeyRound, phase: 1, adminOnly: false }] },
  { label: "History", items: [{ to: "/archive", label: "Archive history", icon: ArchiveRestore, phase: 1, adminOnly: true }] },
  {
    label: "Overview",
    items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard, phase: 1, adminOnly: false }],
  },
  {
    label: "Academic Setup",
    items: [
      { to: "/academic-sessions", label: "Sessions", icon: CalendarRange, phase: 2, adminOnly: true },
      { to: "/classes", label: "Classes & Sections", icon: LayoutGrid, phase: 2, adminOnly: true },
      { to: "/subjects", label: "Subjects", icon: BookOpen, phase: 2, adminOnly: true },
      { to: "/designations", label: "Designations", icon: IdCard, phase: 2, adminOnly: true },
    ],
  },
  {
    label: "People",
    items: [
      { to: "/staff", label: "Staff & Teachers", icon: Users, phase: 3, adminOnly: true },
      { to: "/students", label: "Students", icon: GraduationCap, phase: 4, adminOnly: false },
    ],
  },
  {
    label: "Finance",
    items: [
      { to: "/fees", label: "Fees", icon: Wallet, phase: 5, adminOnly: true },
      { to: "/salaries", label: "Salaries & Expenses", icon: Receipt, phase: 7, adminOnly: true },
    ],
  },
  {
    label: "Academics",
    items: [{ to: "/tests", label: "Tests & Results", icon: ClipboardList, phase: 6, adminOnly: false }],
  },
  { label: "Reports", items: [{ to: "/reports", label: "Reports", icon: FileBarChart, phase: 9, adminOnly: true }] },
];

export const CURRENT_PHASE = 9;
