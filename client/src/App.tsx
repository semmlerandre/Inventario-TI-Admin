import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "./hooks/use-auth";
import { useSettings } from "./hooks/use-settings"; // Need this at root to trigger theme injection
import NotFound from "@/pages/not-found";

// Pages
import AuthPage from "./pages/auth";
import DashboardPage from "./pages/dashboard";
import InventoryPage from "./pages/inventory";
import TransactionsPage from "./pages/transactions";
import SettingsPage from "./pages/settings";

function ProtectedRoute({ component: Component, ...rest }: any) {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }
  
  if (!user) {
    return <Redirect to="/auth" />;
  }

  return <Component {...rest} />;
}

function Router() {
  // Call useSettings here so it fetches once and injects the theme color on load
  useSettings();

  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <Route path="/">
        <ProtectedRoute component={DashboardPage} />
      </Route>
      <Route path="/estoque">
        <ProtectedRoute component={InventoryPage} />
      </Route>
      <Route path="/movimentacoes">
        <ProtectedRoute component={TransactionsPage} />
      </Route>
      <Route path="/configuracoes">
        <ProtectedRoute component={SettingsPage} />
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
