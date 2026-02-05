import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// Layouts
import { CandidateLayout } from "@/components/layouts/CandidateLayout";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";

// Candidate Pages
import Landing from "@/pages/Landing";
import CandidateHome from "@/pages/CandidateHome";
import CandidateLogin from "@/pages/CandidateLogin";
import Assessment from "@/pages/Assessment";
import MCQTest from "@/pages/MCQTest";
import PsychometricTest from "@/pages/PsychometricTest";
import TextBasedTest from "@/pages/TextBasedTest";

// Recruiter Pages
import RecruiterLogin from "@/pages/RecruiterLogin";

// Admin Pages
import Dashboard from "@/pages/admin/Dashboard";
import Candidates from "@/pages/admin/Candidates";
import CandidateDetail from "@/pages/admin/CandidateDetail";
import Settings from "@/pages/admin/Settings";
import PsychometricManagement from "@/pages/admin/PsychometricManagement";
import EvaluationCriteria from "@/pages/admin/EvaluationCriteria";

// Other
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <div className="min-h-screen bg-background text-foreground">
          <Routes>
            {/* Candidate Flow - Minimal Layout */}
            <Route element={<CandidateLayout />}>
              <Route path="/" element={<Landing />} />
              <Route path="/candidate/login" element={<CandidateLogin />} />
              <Route path="/candidate" element={<CandidateHome />} />
              <Route path="/candidate/mcq-test" element={<MCQTest />} />
<<<<<<< Updated upstream
              <Route path="/candidate/psychometric-test" element={<PsychometricTest />} />
              <Route path="/candidate/text-based-test" element={<TextBasedTest />} />
=======
>>>>>>> Stashed changes
              <Route path="/assessment/:id" element={<Assessment />} />
            </Route >

  {/* Recruiter Login - Minimal Layout */ }
  < Route element = {< CandidateLayout />}>
    <Route path="/recruiter/login" element={<RecruiterLogin />} />
            </Route >

  {/* Admin/Recruiter Flow - Dashboard Layout (Protected) */ }
  < Route
path = "/admin"
element = {
                < ProtectedRoute >
  <AdminLayout />
                </ProtectedRoute >
              }
            >
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="candidates" element={<Candidates />} />
              <Route path="psychometric" element={<PsychometricManagement />} />
              <Route path="evaluation-criteria" element={<EvaluationCriteria />} />
              <Route path="candidate/:id" element={<CandidateDetail />} />
              <Route path="settings" element={<Settings />} />
            </Route >

  {/* 404 */ }
  < Route path = "*" element = {< NotFound />} />
          </Routes >
        </div >
      </BrowserRouter >
    </TooltipProvider >
  </QueryClientProvider >
);

export default App;
