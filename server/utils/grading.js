// Single source of truth for turning a raw score into a percentage, a
// letter grade, and a pass/fail outcome. Every controller that needs any
// of these (Tests, Exams, report cards, dashboards) must call this instead
// of recomputing thresholds inline — that's how a future change to the
// grading scale (e.g. admin-configurable bands) only has to happen once.

// Default grade boundaries — swap this for a DB-backed configurable
// scale later without touching any call site, since everything only
// calls gradeFor()/isPassing() below.
const DEFAULT_GRADE_BANDS = [
  { min: 90, grade: "A+" },
  { min: 80, grade: "A" },
  { min: 70, grade: "B" },
  { min: 60, grade: "C" },
  { min: 50, grade: "D" },
  { min: 0, grade: "F" },
];

export function percentageOf(marksObtained, maxMarks) {
  if (!maxMarks || maxMarks <= 0) return 0;
  return Math.round((marksObtained / maxMarks) * 10000) / 100; // 2 decimal places
}

export function gradeFor(percentage, bands = DEFAULT_GRADE_BANDS) {
  const sorted = [...bands].sort((a, b) => b.min - a.min);
  const match = sorted.find((b) => percentage >= b.min);
  return match ? match.grade : "F";
}

export function isPassing(marksObtained, passingMarks) {
  return marksObtained >= passingMarks;
}

export function summarize(marksObtained, maxMarks, passingMarks) {
  const percentage = percentageOf(marksObtained, maxMarks);
  return {
    marksObtained,
    maxMarks,
    percentage,
    grade: gradeFor(percentage),
    passed: isPassing(marksObtained, passingMarks),
  };
}
