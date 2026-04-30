import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "./hooks/use-auth";
import { useSettings } from "./hooks/use-settings";
import NotFound from "@/pages/not-found";

// Pages
import AuthPage from "./pages/auth";
import DashboardPage from "./pages/dashboard";
import InventoryPage from "./pages/inventory";
import TransactionsPage from "./pages/transactions";
import SettingsPage from "./pages/settings";

// Telefonia Móvel
import TelefoniaIndexPage from "./pages/telefonia/index";
import OperadorasPage from "./pages/telefonia/operadoras";
import PlanosPage from "./pages/telefonia/planos";
import ChipsPage from "./pages/telefonia/chips";
import AparelhosPage from "./pages/telefonia/aparelhos";
import LinhasPage from "./pages/telefonia/linhas";
import MovimentacoesPage from "./pages/telefonia/movimentacoes";
import RelatoriosPage from "./pages/telefonia/relatorios";

// Domínios & SSL
import DominiosPage from "./pages/dominios/index";
import DominioFormPage from "./pages/dominios/form";
import DominioNotificacoesPage from "./pages/dominios/notificacoes";
import DominiosRelatoriosPage from "./pages/dominios/relatorios";

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
      {/* Telefonia Móvel */}
      <Route path="/telefonia">
        <ProtectedRoute component={TelefoniaIndexPage} />
      </Route>
      <Route path="/telefonia/operadoras">
        <ProtectedRoute component={OperadorasPage} />
      </Route>
      <Route path="/telefonia/planos">
        <ProtectedRoute component={PlanosPage} />
      </Route>
      <Route path="/telefonia/chips">
        <ProtectedRoute component={ChipsPage} />
      </Route>
      <Route path="/telefonia/aparelhos">
        <ProtectedRoute component={AparelhosPage} />
      </Route>
      <Route path="/telefonia/linhas">
        <ProtectedRoute component={LinhasPage} />
      </Route>
      <Route path="/telefonia/movimentacoes">
        <ProtectedRoute component={MovimentacoesPage} />
      </Route>
      <Route path="/telefonia/relatorios">
        <ProtectedRoute component={RelatoriosPage} />
      </Route>
      {/* Domínios & SSL */}
      <Route path="/dominios">
        <ProtectedRoute component={DominiosPage} />
      </Route>
      <Route path="/dominios/novo">
        <ProtectedRoute component={DominioFormPage} />
      </Route>
      <Route path="/dominios/notificacoes">
        <ProtectedRoute component={DominioNotificacoesPage} />
      </Route>
      <Route path="/dominios/relatorios">
        <ProtectedRoute component={DominiosRelatoriosPage} />
      </Route>
      <Route path="/dominios/:id/editar">
        <ProtectedRoute component={DominioFormPage} />
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
