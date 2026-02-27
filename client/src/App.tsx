import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "./lib/auth";
import NotFound from "@/pages/not-found";

import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Teams from "@/pages/Teams";
import Players from "@/pages/Players";
import Matches from "@/pages/Matches";
import Stats from "@/pages/Stats";
import Attendance from "@/pages/Attendance";
import Finance from "@/pages/Finance";
import Injuries from "@/pages/Injuries";
import Awards from "@/pages/Awards";
import Reports from "@/pages/Reports";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  if (!user) return <Redirect to="/" />;
  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Login}/>
      <Route path="/dashboard">{() => <ProtectedRoute component={Dashboard} />}</Route>
      <Route path="/teams">{() => <ProtectedRoute component={Teams} />}</Route>
      <Route path="/players">{() => <ProtectedRoute component={Players} />}</Route>
      <Route path="/matches">{() => <ProtectedRoute component={Matches} />}</Route>
      <Route path="/stats">{() => <ProtectedRoute component={Stats} />}</Route>
      <Route path="/attendance">{() => <ProtectedRoute component={Attendance} />}</Route>
      <Route path="/finance">{() => <ProtectedRoute component={Finance} />}</Route>
      <Route path="/injuries">{() => <ProtectedRoute component={Injuries} />}</Route>
      <Route path="/awards">{() => <ProtectedRoute component={Awards} />}</Route>
      <Route path="/reports">{() => <ProtectedRoute component={Reports} />}</Route>
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
          <Router />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
