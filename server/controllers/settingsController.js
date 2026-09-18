import AcademySettings from "../models/AcademySettings.js";

export const DEFAULT_SETTINGS = {
  academyName: "Academy Management",
  academyPhone: "",
  receiptName: "",
  receiptPhone: "",
  receiptFooter: "Thank you for your payment.",
};

export async function getSettings(_req, res, next) {
  try {
    const settings = await AcademySettings.findById("academy").lean();
    res.json(settings || DEFAULT_SETTINGS);
  } catch (error) {
    next(error);
  }
}

export async function updateSettings(req, res, next) {
  try {
    const values = {};
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      if (req.body[key] !== undefined) values[key] = String(req.body[key]).trim();
    }
    if ("academyName" in values && !values.academyName) return res.status(400).json({ message: "Academy name is required" });
    const settings = await AcademySettings.findByIdAndUpdate(
      "academy",
      { $set: values, $setOnInsert: { _id: "academy" } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean();
    res.json(settings);
  } catch (error) {
    next(error);
  }
}
