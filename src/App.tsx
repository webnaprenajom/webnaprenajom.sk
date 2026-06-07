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
import AdminLogs from "./pages/AdminLogs";
import AdminProjectNotes from "./pages/AdminProjectNotes";
import AdminCommissions from "./pages/AdminCommissions";
import AdminTasks from "./pages/AdminTasks";
import AdminRentals from "./pages/AdminRentals";
import AdminWheelLeads from "./pages/AdminWheelLeads";
import AdminDebug from "./pages/AdminDebug";
import AdminSignatures from "./pages/AdminSignatures";
import AdminDesigns from "./pages/AdminDesigns";
import OrderSignature from "./pages/OrderSignature";
import OfferRedeemDialog from "./components/OfferRedeemDialog";
import ErrorBoundary from "./components/ErrorBoundary";

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
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/today" element={<AdminToday />} />
            <Route path="/admin/logs" element={<AdminLogs />} />
            <Route path="/admin/notes" element={<AdminProjectNotes />} />
            <Route path="/admin/commissions" element={<AdminCommissions />} />
            <Route path="/admin/tasks" element={<AdminTasks />} />
            <Route path="/admin/rentals" element={<AdminRentals />} />
            <Route path="/admin/wheel-leads" element={<AdminWheelLeads />} />
            <Route path="/admin/debug" element={<AdminDebug />} />
            <Route path="/admin/signatures" element={<AdminSignatures />} />
            <Route path="/admin/designs" element={<AdminDesigns />} />
            <Route path="/objednavka" element={<OrderSignature />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ErrorBoundary>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
