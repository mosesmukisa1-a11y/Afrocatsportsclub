import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "./lib/auth";
import NotFound from "@/pages/not-found";
import ErrorBoundary from "@/components/ErrorBoundary";

import Login from "@/pages/Login";
import PublicHome from "@/pages/PublicHome";
import PublicMedia from "@/pages/PublicMedia";
import PublicShop from "@/pages/PublicShop";
import Dashboard from "@/pages/Dashboard";
import Teams from "@/pages/Teams";
import Players from "@/pages/Players";
import Matches from "@/pages/Matches";
import Attendance from "@/pages/Attendance";
import Finance from "@/pages/Finance";
import Injuries from "@/pages/Injuries";
import Awards from "@/pages/Awards";
import Coaches from "@/pages/Coaches";
import Contracts from "@/pages/Contracts";
import Documents from "@/pages/Documents";
import Reports from "@/pages/Reports";
import PlayerDashboard from "@/pages/PlayerDashboard";
import Register from "@/pages/Register";
import ProfileSetup from "@/pages/ProfileSetup";
import VerifyEmail from "@/pages/VerifyEmail";
import AdminRegistrations from "@/pages/AdminRegistrations";
import ChangePassword from "@/pages/ChangePassword";
import ResetPassword from "@/pages/ResetPassword";
import ForgotPassword from "@/pages/ForgotPassword";
import AdminUsers from "@/pages/AdminUsers";
import MyContract from "@/pages/MyContract";
import ClubContract from "@/pages/ClubContract";
import TouchStats from "@/pages/TouchStats";
import DevStats from "@/pages/DevStats";
import CoachDashboard from "@/pages/CoachDashboard";
import StatsComparison from "@/pages/StatsComparison";
import Chat from "@/pages/Chat";
import MatchSimulation from "@/pages/MatchSimulation";
import ReportTemplates from "@/pages/ReportTemplates";
import EmailCompose from "@/pages/EmailCompose";
import CoachBlog from "@/pages/CoachBlog";
import Media from "@/pages/Media";
import PlayerInterviews from "@/pages/PlayerInterviews";
import Officials from "@/pages/Officials";
import SystemCheck from "@/pages/SystemCheck";
import MemberExtract from "@/pages/MemberExtract";

function ProtectedRoute({ component: Component, allowMustChange }: { component: React.ComponentType; allowMustChange?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  if (!user) return <Redirect to="/login" />;
  if (user.mustChangePassword && !allowMustChange) return <Redirect to="/change-password" />;
  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={PublicHome}/>
      <Route path="/login" component={Login}/>
      <Route path="/media" component={PublicMedia}/>
      <Route path="/shop" component={PublicShop}/>
      <Route path="/register" component={Register}/>
      <Route path="/verify-email" component={VerifyEmail}/>
      <Route path="/forgot-password" component={ForgotPassword}/>
      <Route path="/reset-password" component={ResetPassword}/>
      <Route path="/change-password">{() => <ProtectedRoute component={ChangePassword} allowMustChange />}</Route>
      <Route path="/dashboard">{() => <ProtectedRoute component={Dashboard} />}</Route>
      <Route path="/profile-setup">{() => <ProtectedRoute component={ProfileSetup} />}</Route>
      <Route path="/teams">{() => <ProtectedRoute component={Teams} />}</Route>
      <Route path="/players">{() => <ProtectedRoute component={Players} />}</Route>
      <Route path="/matches">{() => <ProtectedRoute component={Matches} />}</Route>
      <Route path="/stats">{() => <ProtectedRoute component={TouchStats} />}</Route>
      <Route path="/dev-stats">{() => <ProtectedRoute component={DevStats} />}</Route>
      <Route path="/coach-dashboard">{() => <ProtectedRoute component={CoachDashboard} />}</Route>
      <Route path="/attendance">{() => <ProtectedRoute component={Attendance} />}</Route>
      <Route path="/finance">{() => <ProtectedRoute component={Finance} />}</Route>
      <Route path="/injuries">{() => <ProtectedRoute component={Injuries} />}</Route>
      <Route path="/awards">{() => <ProtectedRoute component={Awards} />}</Route>
      <Route path="/coaches">{() => <ProtectedRoute component={Coaches} />}</Route>
      <Route path="/contracts">{() => <ProtectedRoute component={Contracts} />}</Route>
      <Route path="/documents">{() => <ProtectedRoute component={Documents} />}</Route>
      <Route path="/reports">{() => <Redirect to="/report-templates" />}</Route>
      <Route path="/player-dashboard">{() => <ProtectedRoute component={PlayerDashboard} />}</Route>
      <Route path="/my-contract">{() => <Redirect to="/contracts" />}</Route>
      <Route path="/club-contract">{() => <Redirect to="/contracts" />}</Route>
      <Route path="/admin/registrations">{() => <ProtectedRoute component={AdminRegistrations} />}</Route>
      <Route path="/admin/users">{() => <ProtectedRoute component={AdminUsers} />}</Route>
      <Route path="/stats-comparison">{() => <ProtectedRoute component={StatsComparison} />}</Route>
      <Route path="/chat">{() => <ProtectedRoute component={Chat} />}</Route>
      <Route path="/match-simulation">{() => <ProtectedRoute component={MatchSimulation} />}</Route>
      <Route path="/report-templates">{() => <ProtectedRoute component={ReportTemplates} />}</Route>
      <Route path="/notices">{() => <Redirect to="/coach-blog" />}</Route>
      <Route path="/email-compose">{() => <ProtectedRoute component={EmailCompose} />}</Route>
      <Route path="/coach-blog">{() => <ProtectedRoute component={CoachBlog} />}</Route>
      <Route path="/media-gallery">{() => <ProtectedRoute component={Media} />}</Route>
      <Route path="/interviews">{() => <ProtectedRoute component={PlayerInterviews} />}</Route>
      <Route path="/officials">{() => <ProtectedRoute component={Officials} />}</Route>
      <Route path="/admin/system-check">{() => <ProtectedRoute component={SystemCheck} />}</Route>
      <Route path="/admin/member-extract">{() => <ProtectedRoute component={MemberExtract} />}</Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <ErrorBoundary>
            <Router />
          </ErrorBoundary>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
