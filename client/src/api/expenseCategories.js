import { createResourceApi } from "./resource";

// Plain admin-managed reference data via the shared crudFactory, same as
// Designations — deleting a category that has expenses against it 409s
// server-side (routes/expenseCategoryRoutes.js's beforeDelete guard).
export const expenseCategoriesApi = createResourceApi("/expense-categories");
