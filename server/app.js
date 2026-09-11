import express from "express";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import mongoSanitize from "express-mongo-sanitize";

import { config } from "./config/env.js";
import { issueCsrfCookie, verifyCsrf } from "./middleware/csrf.js";
import { apiRateLimiter } from "./middleware/rateLimiters.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";

import authRoutes from "./routes/authRoutes.js";
import academicSessionRoutes from "./routes/academicSessionRoutes.js";
import classRoutes from "./routes/classRoutes.js";
import sectionRoutes from "./routes/sectionRoutes.js";
import subjectRoutes from "./routes/subjectRoutes.js";
import designationRoutes from "./routes/designationRoutes.js";
import staffRoutes from "./routes/staffRoutes.js";
import teacherAssignmentRoutes from "./routes/teacherAssignmentRoutes.js";
import studentRoutes from "./routes/studentRoutes.js";
import feeRoutes from "./routes/feeRoutes.js";
import testRoutes from "./routes/testRoutes.js";
import expenseCategoryRoutes from "./routes/expenseCategoryRoutes.js";
import expenseRoutes from "./routes/expenseRoutes.js";
import salaryRoutes from "./routes/salaryRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import archiveRoutes from "./routes/archiveRoutes.js";

const app = express();

// --- Security & parsing middleware ---
app.set("trust proxy", process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) : false); // needed for correct client IPs behind Render/Railway/etc.
app.use(helmet());
app.use(
  cors({
    origin: config.clientUrl,
    credentials: true, // required so the browser sends/receives cookies cross-origin
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(mongoSanitize()); // strips $/. operators from req.body/query/params

if (!config.isProd) {
  app.use(morgan("dev"));
}

app.use(apiRateLimiter);
app.use(issueCsrfCookie);
app.use(verifyCsrf);

// --- Routes ---
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", env: config.nodeEnv });
});

app.use("/api/auth", authRoutes);
app.use("/api/academic-sessions", academicSessionRoutes);
app.use("/api/classes", classRoutes);
app.use("/api/sections", sectionRoutes);
app.use("/api/subjects", subjectRoutes);
app.use("/api/designations", designationRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/teacher-assignments", teacherAssignmentRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/fees", feeRoutes);
app.use("/api/tests", testRoutes);
app.use("/api/expense-categories", expenseCategoryRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/salaries", salaryRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/archive", archiveRoutes);

const clientDist = fileURLToPath(new URL("../client/dist/", import.meta.url));
if (config.isProd && existsSync(clientDist + "index.html")) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api(?:\/|$)).*/, (req, res) => res.sendFile(clientDist + "index.html"));
}

// --- 404 + error handling (must be last) ---
app.use(notFound);
app.use(errorHandler);

export default app;
