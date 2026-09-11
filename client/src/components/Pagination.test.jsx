import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Pagination from "./Pagination";

describe("Pagination", () => {
  it("renders nothing when there are zero total results", () => {
    const { container } = render(<Pagination page={1} totalPages={1} total={0} onChange={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("disables 'previous' on the first page and 'next' on the last page", () => {
    render(<Pagination page={1} totalPages={1} total={5} onChange={() => {}} />);
    expect(screen.getByLabelText("Previous page")).toBeDisabled();
    expect(screen.getByLabelText("Next page")).toBeDisabled();
  });

  it("calls onChange with page + 1 when next is clicked mid-range", async () => {
    const onChange = vi.fn();
    render(<Pagination page={2} totalPages={5} total={100} onChange={onChange} />);
    const user = userEvent.setup();
    await user.click(screen.getByLabelText("Next page"));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it("calls onChange with page - 1 when previous is clicked", async () => {
    const onChange = vi.fn();
    render(<Pagination page={3} totalPages={5} total={100} onChange={onChange} />);
    const user = userEvent.setup();
    await user.click(screen.getByLabelText("Previous page"));
    expect(onChange).toHaveBeenCalledWith(2);
  });
});
