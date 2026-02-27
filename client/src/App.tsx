import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Teams from "@/pages/Teams";
import Players from "@/pages/Players";
import Matches from "@/pages/Matches";
import Stats from "@/pages/Stats";
// Additional stubs
const Placeholder = ({ title }: { title: string }) => {
  return (
    <div className="flex h-screen items-center justify-center bg-background p-4">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-display font-bold text-foreground">{title}</h1>
        <p className="text-muted-foreground">This module is part of the Afrocat Club Portal mockup.</p>
        <button onClick={() => window.history.back()} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium">Go Back</button>
      </div>
    </div>
  );
};

function Router() {
  return (
    <Switch>
      <Route path="/" component={Login}/>
      <Route path="/dashboard" component={Dashboard}/>
      <Route path="/teams" component={Teams}/>
      <Route path="/players" component={Players}/>
      <Route path="/matches" component={Matches}/>
      <Route path="/stats" component={Stats}/>
      
      <Route path="/attendance">
        <Placeholder title="Attendance & Discipline" />
      </Route>
      <Route path="/finance">
        <Placeholder title="Finance Module" />
      </Route>
      <Route path="/injuries">
        <Placeholder title="Wellness & Injuries" />
      </Route>
      <Route path="/reports">
        <Placeholder title="Reports & Export" />
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;