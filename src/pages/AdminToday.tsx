import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AdminShell } from "@/components/admin/AdminShell";
import TodayMustDoSection from "@/components/admin/TodayMustDoSection";

const AdminToday = () => {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Dnes | CRM";
  }, []);

  return (
    <AdminShell title="Dnes" subtitle="Command center — dnešné priority a follow-upy">
      <TodayMustDoSection onLeadClick={(id) => navigate(`/admin?lead=${id}`)} />
    </AdminShell>
  );
};

export default AdminToday;
