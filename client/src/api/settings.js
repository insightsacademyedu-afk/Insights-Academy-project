import api from "./client";

export const fetchSettings = () => api.get("/settings").then((response) => response.data);
export const updateSettings = (values) => api.put("/settings", values).then((response) => response.data);
