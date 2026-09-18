import { createContext, useContext } from "react";
import { updateSettings } from "../api/settings";

export const DEFAULT_ACADEMY_SETTINGS = {
  academyName: "Academy Management",
  academyPhone: "",
  receiptName: "",
  receiptPhone: "",
  receiptFooter: "Thank you for your payment.",
};

export const AcademyContext = createContext({ settings: DEFAULT_ACADEMY_SETTINGS, saveSettings: updateSettings });
export const useAcademy = () => useContext(AcademyContext);
