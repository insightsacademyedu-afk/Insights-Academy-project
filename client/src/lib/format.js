export function formatCurrency(n) {
  const value = Number.isFinite(Number(n)) ? Number(n) : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "PKR",
    currencyDisplay: "code",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(n) {
  return new Intl.NumberFormat("en-US").format(Number(n) || 0);
}

export function formatDate(d) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric" }).format(
    new Date(d)
  );
}

// yyyy-mm-dd for <input type="date"> value props
export function toDateInputValue(d) {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}
