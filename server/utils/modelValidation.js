// Every controller/crudFactory error handler in this codebase checks
// `err.name === "ValidationError"` to decide whether to return 400 (client
// mistake) vs falling through to the generic 500 handler. That check is
// how mongoose's own built-in schema validators (required, enum, min,
// match, etc.) report failures.
//
// A plain `next(new Error("..."))` thrown from a *custom* pre("validate")
// hook does NOT get that treatment — its `err.name` stays "Error", so it
// silently falls through to a 500 everywhere, even though it's exactly
// the same kind of "the request was invalid" situation. Use this helper
// from any custom pre-validate hook instead of `new Error(...)` so cross-
// field/cross-document checks (e.g. "this section doesn't belong to this
// class", "this referenced id doesn't exist") report a 400 just like any
// other validation failure.
export function validationError(message) {
  const err = new Error(message);
  err.name = "ValidationError";
  return err;
}
