import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import StatusBadge from "./StatusBadge";

describe("StatusBadge", () => {
  it("renders the status text with underscores turned into spaces", () => {
    render(<StatusBadge status="partially_paid" />);
    expect(screen.getByText("partially paid")).toBeInTheDocument();
  });

  it("applies the brick (danger) tone for unpaid/overdue/failed", () => {
    render(<StatusBadge status="overdue" />);
    expect(screen.getByText("overdue")).toHaveClass("bg-brick-100");
  });

  it("applies the moss (success) tone for paid/completed/finalized", () => {
    render(<StatusBadge status="finalized" />);
    expect(screen.getByText("finalized")).toHaveClass("bg-moss-100");
  });

  it("falls back to the neutral ink tone for an unrecognized status", () => {
    render(<StatusBadge status="some_future_status" />);
    expect(screen.getByText("some future status")).toHaveClass("bg-ink-100");
  });
});
