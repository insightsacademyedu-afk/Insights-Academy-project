import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";

const mockUseAuth = vi.fn();
vi.mock("../context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

function renderAt(path, { adminOnly = false } = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<div>Login page</div>} />
        <Route path="/" element={<div>Home page</div>} />
        <Route
          path="/secret"
          element={
            <ProtectedRoute adminOnly={adminOnly}>
              <div>Secret content</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("ProtectedRoute", () => {
  it("shows a loading state while the session is still bootstrapping", () => {
    mockUseAuth.mockReturnValue({ user: null, status: "loading" });
    renderAt("/secret");
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("redirects an anonymous user to /login", () => {
    mockUseAuth.mockReturnValue({ user: null, status: "anonymous" });
    renderAt("/secret");
    expect(screen.getByText("Login page")).toBeInTheDocument();
  });

  it("renders the protected content for an authenticated non-admin route", () => {
    mockUseAuth.mockReturnValue({ user: { role: "staff" }, status: "authenticated" });
    renderAt("/secret");
    expect(screen.getByText("Secret content")).toBeInTheDocument();
  });

  it("redirects a non-admin user away from an adminOnly route", () => {
    mockUseAuth.mockReturnValue({ user: { role: "staff" }, status: "authenticated" });
    renderAt("/secret", { adminOnly: true });
    expect(screen.getByText("Home page")).toBeInTheDocument();
  });

  it("lets an admin through an adminOnly route", () => {
    mockUseAuth.mockReturnValue({ user: { role: "admin" }, status: "authenticated" });
    renderAt("/secret", { adminOnly: true });
    expect(screen.getByText("Secret content")).toBeInTheDocument();
  });
});
