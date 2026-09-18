import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { fetchSettings, updateSettings } from "../api/settings";
import { AcademyContext, DEFAULT_ACADEMY_SETTINGS } from "./academy";

export function AcademyProvider({ children }) {
  const { status } = useAuth();
  const [settings, setSettings] = useState(DEFAULT_ACADEMY_SETTINGS);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetchSettings().then((value) => setSettings({ ...DEFAULT_ACADEMY_SETTINGS, ...value })).catch(() => {});
  }, [status]);

  const saveSettings = useCallback(async (values) => {
    const saved = await updateSettings(values);
    setSettings({ ...DEFAULT_ACADEMY_SETTINGS, ...saved });
    return saved;
  }, []);

  return <AcademyContext.Provider value={{ settings, saveSettings }}>{children}</AcademyContext.Provider>;
}
