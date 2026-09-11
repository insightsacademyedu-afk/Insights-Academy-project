import { describe, it, expect } from "vitest";
import { formatCurrency, formatNumber, formatDate, toDateInputValue } from "./format";

describe("formatCurrency", () => {
  it("formats a positive number as PKR with paisa", () => {
    expect(formatCurrency(1234)).toBe("PKR\u00a01,234.00");
  });

  it("treats null/undefined/NaN as zero rather than throwing", () => {
    expect(formatCurrency(null)).toBe("PKR\u00a00.00");
    expect(formatCurrency(undefined)).toBe("PKR\u00a00.00");
    expect(formatCurrency("not-a-number")).toBe("PKR\u00a00.00");
  });

  it("coerces numeric strings", () => {
    expect(formatCurrency("500")).toBe("PKR\u00a0500.00");
  });
});

it("preserves paisa and handles negative adjustments in PKR", () => {
 expect(formatCurrency(1234.56)).toBe("PKR\u00a01,234.56");
 expect(formatCurrency(-0.1)).toBe("-PKR\u00a00.10");
 expect(formatCurrency(Infinity)).toBe("PKR\u00a00.00");
});

describe("formatNumber", () => {
  it("adds thousands separators", () => {
    expect(formatNumber(1000000)).toBe("1,000,000");
  });

  it("treats non-numeric input as zero", () => {
    expect(formatNumber(undefined)).toBe("0");
  });
});

describe("formatDate", () => {
  it("renders an em dash for a falsy input instead of 'Invalid Date'", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
    expect(formatDate("")).toBe("—");
  });

  it("formats an ISO date string as a short, human-readable date", () => {
    expect(formatDate("2026-01-15T00:00:00.000Z")).toBe("Jan 15, 2026");
  });
});

describe("toDateInputValue", () => {
  it("returns an empty string for a falsy input", () => {
    expect(toDateInputValue(null)).toBe("");
  });

  it("returns yyyy-mm-dd suitable for <input type=date>", () => {
    expect(toDateInputValue("2026-03-05T10:00:00.000Z")).toBe("2026-03-05");
  });
});
