import { Navigate } from "react-router-dom";

/** Legacy route — redirects to Projekty. */
export default function AdminProjectNotes() {
  return <Navigate to="/admin/projects" replace />;
}
