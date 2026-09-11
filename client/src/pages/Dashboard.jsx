import { useAuth } from "../context/AuthContext";
import DashboardAdmin from "./DashboardAdmin";
import DashboardTeacher from "./DashboardTeacher";

export default function Dashboard() {
  const { user } = useAuth();
  return user?.role === "admin" ? <DashboardAdmin /> : <DashboardTeacher />;
}
