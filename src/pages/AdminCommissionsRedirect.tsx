import { Navigate } from "react-router-dom";

/** Legacy route — provízie presunuté do Financií (pokročilé). */
export default function AdminCommissionsRedirect() {
  return <Navigate to="/admin/finance?advanced=1&legacy=commissions" replace />;
}
