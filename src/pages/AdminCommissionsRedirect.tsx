import { Navigate } from "react-router-dom";

/** Legacy route — provízie riešte v Prenájmy / denných Financiách, nie v CRUD tabe. */
export default function AdminCommissionsRedirect() {
  return <Navigate to="/admin/finance" replace />;
}
