import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Package, ArrowLeftRight, Settings, LogOut, Loader2, Server,
  Smartphone, ChevronDown, ChevronRight, Building2, CreditCard, Cpu, Phone, BarChart3,
  Globe, Shield, Bell
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useSettings } from "@/hooks/use-settings";
import { Button } from "@/components/ui/button";

const TELEFONIA_ROUTES = [
  "/telefonia",
  "/telefonia/operadoras",
  "/telefonia/planos",
  "/telefonia/chips",
  "/telefonia/aparelhos",
  "/telefonia/linhas",
  "/telefonia/movimentacoes",
  "/telefonia/relatorios",
];

const DOMINIOS_ROUTES = [
  "/dominios",
  "/dominios/novo",
  "/dominios/notificacoes",
];

export function AppLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { data: settings, isLoading: isSettingsLoading } = useSettings();

  // Open telefonia submenu if we're on a telefonia route
  const [telefoniaOpen, setTelefoniaOpen] = useState(() =>
    TELEFONIA_ROUTES.some(r => location === r || location.startsWith("/telefonia"))
  );
  const [dominiosOpen, setDominiosOpen] = useState(() =>
    location.startsWith("/dominios")
  );

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/estoque", label: "Estoque", icon: Package },
    { href: "/movimentacoes", label: "Movimentações", icon: ArrowLeftRight },
    ...(user?.isAdmin ? [{ href: "/configuracoes", label: "Configurações", icon: Settings }] : []),
  ];

  const telefoniaSubItems = [
    { href: "/telefonia", label: "Visão Geral", icon: LayoutDashboard },
    { href: "/telefonia/linhas", label: "Linhas", icon: Phone },
    { href: "/telefonia/operadoras", label: "Operadoras", icon: Building2 },
    { href: "/telefonia/planos", label: "Planos", icon: CreditCard },
    { href: "/telefonia/chips", label: "Chips", icon: Cpu },
    { href: "/telefonia/aparelhos", label: "Aparelhos", icon: Smartphone },
    { href: "/telefonia/movimentacoes", label: "Movimentações", icon: ArrowLeftRight },
    { href: "/telefonia/relatorios", label: "Relatórios", icon: BarChart3 },
  ];

  const isTelefoniaActive = TELEFONIA_ROUTES.some(r => location === r);
  const isDominiosActive = location.startsWith("/dominios");

  const dominiosSubItems = [
    { href: "/dominios", label: "Visão Geral", icon: Globe },
    { href: "/dominios/notificacoes", label: "Alertas", icon: Bell },
  ];

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50/50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shadow-sm z-10 relative">
        <div className="h-16 flex items-center px-6 border-b border-slate-100">
          {isSettingsLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : (
            <div className="flex items-center gap-3">
              {(settings?.logoData || settings?.logoUrl) ? (
                <img src={settings.logoData || settings.logoUrl!} alt="Logo" className="h-8 w-8 rounded-md object-contain" />
              ) : (
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Server className="h-4 w-4" />
                </div>
              )}
              <span className="font-display font-bold text-lg text-slate-900 truncate">
                {settings?.appName || "TI Inventory"}
              </span>
            </div>
          )}
        </div>

        <nav className="flex-1 py-4 px-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 font-medium
                  ${isActive
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }
                `}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}

          {/* Telefonia Móvel Section */}
          <div>
            <button
              onClick={() => setTelefoniaOpen(o => !o)}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 font-medium
                ${isTelefoniaActive
                  ? "bg-primary/10 text-primary"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }
              `}
              data-testid="nav-telefonia-toggle"
            >
              <Smartphone className="h-5 w-5 flex-shrink-0" />
              <span className="flex-1 text-left">Telefonia Móvel</span>
              {telefoniaOpen
                ? <ChevronDown className="h-4 w-4 flex-shrink-0" />
                : <ChevronRight className="h-4 w-4 flex-shrink-0" />
              }
            </button>

            {telefoniaOpen && (
              <div className="mt-1 ml-4 pl-3 border-l-2 border-slate-100 space-y-0.5">
                {telefoniaSubItems.map(item => {
                  const isActive = location === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`
                        flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-150 text-sm font-medium
                        ${isActive
                          ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                          : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                        }
                      `}
                      data-testid={`nav-${item.href.replace(/\//g, "-").slice(1)}`}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Domínios & SSL Section */}
          <div>
            <button
              onClick={() => setDominiosOpen(o => !o)}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 font-medium
                ${isDominiosActive
                  ? "bg-primary/10 text-primary"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }
              `}
              data-testid="nav-dominios-toggle"
            >
              <Globe className="h-5 w-5 flex-shrink-0" />
              <span className="flex-1 text-left">Domínios & SSL</span>
              {dominiosOpen
                ? <ChevronDown className="h-4 w-4 flex-shrink-0" />
                : <ChevronRight className="h-4 w-4 flex-shrink-0" />
              }
            </button>

            {dominiosOpen && (
              <div className="mt-1 ml-4 pl-3 border-l-2 border-slate-100 space-y-0.5">
                {dominiosSubItems.map(item => {
                  const isActive = location === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`
                        flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-150 text-sm font-medium
                        ${isActive
                          ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                          : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                        }
                      `}
                      data-testid={`nav-${item.href.replace(/\//g, "-").slice(1)}`}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="bg-slate-50 rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                {user.username.substring(0, 2).toUpperCase()}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-slate-900 leading-tight">
                  {user.isAdmin ? "Admin" : "Usuário"}
                </span>
                <span className="text-xs text-slate-500 leading-tight">@{user.username}</span>
              </div>
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start text-slate-500 hover:text-destructive hover:bg-destructive/10"
              onClick={() => logout()}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col max-h-screen overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-primary/5 to-transparent -z-10 pointer-events-none" />
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
