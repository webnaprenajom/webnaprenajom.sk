import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import LocalizedPage from "./pages/LocalizedPage";
import Auth from "./pages/Auth";
import Admin from "./pages/Admin";
import AdminToday from "./pages/AdminToday";
import AdminCustomer from "./pages/AdminCustomer";
import AdminLogs from "./pages/AdminLogs";
import AdminProjectNotes from "./pages/AdminProjectNotes";
import AdminCommissionsRedirect from "./pages/AdminCommissionsRedirect";
import AdminProjects from "./pages/AdminProjects";
import AdminProjectDetail from "./pages/AdminProjectDetail";
import AdminHostingDetail from "./pages/AdminHostingDetail";
import AdminPasswords from "./pages/AdminPasswords";
import AdminHosting from "./pages/AdminHosting";
import AdminClients from "./pages/AdminClients";
import AdminSettings from "./pages/AdminSettings";
import AdminTasks from "./pages/AdminTasks";
import AdminRentals from "./pages/AdminRentals";
import AdminWheelLeads from "./pages/AdminWheelLeads";
import AdminDebug from "./pages/AdminDebug";
import AdminSignatures from "./pages/AdminSignatures";
import AdminDesigns from "./pages/AdminDesigns";
import AdminCommunicationOps from "./pages/AdminCommunicationOps";
import AdminRolloutHealth from "./pages/AdminRolloutHealth";
import AdminFinance from "./pages/AdminFinance";
import OrderSignature from "./pages/OrderSignature";
import OfferRedeemDialog from "./components/OfferRedeemDialog";
import ErrorBoundary from "./components/ErrorBoundary";
import { ProtectedAdminOutlet } from "./components/admin/rbac/ProtectedAdminOutlet";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <OfferRedeemDialog />
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/en" element={<LocalizedPage lang="en" />} />
            <Route path="/de" element={<LocalizedPage lang="de" />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/admin" element={<ProtectedAdminOutlet />}>
              <Route index element={<Admin />} />
              <Route path="today" element={<AdminToday />} />
              <Route path="customer/:customerKey" element={<AdminCustomer />} />
              <Route path="customers/:customerId" element={<AdminCustomer />} />
              <Route path="logs" element={<AdminLogs />} />
              <Route path="communication-ops" element={<AdminCommunicationOps />} />
              <Route path="rollout-health" element={<AdminRolloutHealth />} />
              <Route path="notes" element={<AdminProjectNotes />} />
              <Route path="projects" element={<AdminProjects />} />
              <Route path="projects/:id" element={<AdminProjectDetail />} />
              <Route path="passwords" element={<AdminPasswords />} />
              <Route path="hosting" element={<AdminHosting />} />
              <Route path="hosting/:id" element={<AdminHostingDetail />} />
              <Route path="clients" element={<AdminClients />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="commissions" element={<AdminCommissionsRedirect />} />
              <Route path="finance" element={<AdminFinance />} />
              <Route path="tasks" element={<AdminTasks />} />
              <Route path="rentals" element={<AdminRentals />} />
              <Route path="wheel-leads" element={<AdminWheelLeads />} />
              <Route path="debug" element={<AdminDebug />} />
              <Route path="signatures" element={<AdminSignatures />} />
              <Route path="designs" element={<AdminDesigns />} />
            </Route>
            <Route path="/objednavka" element={<OrderSignature />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ErrorBoundary>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
