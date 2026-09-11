import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { list, create, getOne, roster, enterMarks, finalize, amendMark } from "../controllers/testController.js";

const router = Router();

// Both admin and teacher use these routes — every ownership/assignment
// check happens inside the controller (loadTestForMutation, and the
// assignment check in create()), not via a role gate here, since "is this
// teacher allowed to touch THIS specific test" isn't a static role check.
router.use(requireAuth);

router.get("/", list);
router.post("/", create);
router.get("/:id", getOne);
router.get("/:id/roster", roster);
router.post("/:id/marks", enterMarks);
router.post("/:id/finalize", finalize);
router.post("/:id/amend", amendMark);

export default router;
