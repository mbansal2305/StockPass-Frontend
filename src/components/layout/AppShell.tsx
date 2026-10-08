import React, { useState } from 'react';
import { useApp, NavigationPage } from '../../context/AppContext';
import stockpassLogo from '../../stockpasslogo.png';
import {
  LayoutDashboard,
  ClipboardList,
  Truck,
  WalletCards,
  ReceiptText,
  FileText,
  Layers,
  Database,
  Users,
  Menu,
  X,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Shield,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  Info
} from 'lucide-react';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const {
    currentUser,
    logout,
    currentPage,
    navigate,
    setMasterDataTab,
    resetAllDemoData,
    toasts,
    dismissToast,
    mobileMenuOpen,
    setMobileMenuOpen,
    isBackendConnected
  } = useApp();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const getPageTitle = () => {
    switch (currentPage) {
      case 'dashboard': return 'Operational Dashboard';
      case 'orders': return 'Orders & Fulfillment';
      case 'order-detail': return 'Order Details';
      case 'order-form': return 'Order Entry';
      case 'transport': return 'Transport Fleet & Tracking';
      case 'transport-payments': return 'Transport Payments';
      case 'transport-detail': return 'Transport Consignment Details';
      case 'transport-form': return 'Transport Entry';
      case 'bulk-transport-list': return 'Bulk Transport List';
      case 'bulk-transport': return 'Bulk Transport Dispatch';
      case 'master-data': return 'Master Data Repository';
      case 'expenses': return 'Expense Bills';
      case 'bill-hisaab': return 'Bill Hisaab';
      case 'employees': return 'Employee Management & Access Control';
      default: return 'Dashboard';
    }
  };

  const navItems = [
    {
      group: 'DASHBOARD',
      items: [
        { id: 'dashboard' as NavigationPage, label: 'Overview', icon: LayoutDashboard }
      ]
    },
    {
      group: 'OPERATIONS',
      items: [
        { id: 'orders' as NavigationPage, label: 'Orders', icon: ClipboardList },
        { id: 'transport' as NavigationPage, label: 'Transport', icon: Truck },
        { id: 'transport-payments' as NavigationPage, label: 'Transport Payments', icon: WalletCards },
        { id: 'bulk-transport-list' as NavigationPage, label: 'Bulk Transports', icon: Layers },
        { id: 'expenses' as NavigationPage, label: 'Expenses', icon: ReceiptText },
        { id: 'bill-hisaab' as NavigationPage, label: 'Bill Hisaab', icon: FileText }
      ]
    },
    {
      group: 'MASTER DATA',
      items: [
        { id: 'master-data' as NavigationPage, label: 'Master Data', icon: Database }
      ]
    },
    ...(currentUser?.role === 'OWNER' ? [
      {
        group: 'MANAGEMENT',
        items: [
          { id: 'employees' as NavigationPage, label: 'Employees', icon: Users }
        ]
      }
    ] : [])
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col antialiased">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 h-14 flex items-center justify-between px-4 sm:px-6 shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden p-1.5 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2.5">
            <img src={stockpassLogo} alt="StockPass logo" className="w-8 h-8 object-contain" />
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm text-slate-900 tracking-tight leading-none">
                  StockPass
                </span>
                <span className={`w-2 h-2 rounded-full ${isBackendConnected ? 'bg-emerald-500' : 'bg-amber-400'}`} title={isBackendConnected ? 'Connected to ngrok API' : 'Using Local/Offline store'} />
              </div>
              <span className="text-[10px] text-slate-500 font-medium">
                {getPageTitle()}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Reset Demo Data Button */}
          <button
            type="button"
            onClick={resetAllDemoData}
            title="Reset to fresh demo data"
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* User Profile & Role Info */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="flex items-center gap-2 pl-2 pr-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <div className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-semibold">
                {currentUser?.name?.charAt(0) || 'U'}
              </div>
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-xs font-semibold text-slate-800 leading-tight">
                  {currentUser?.name}
                </span>
                <span className="text-[10px] font-medium text-slate-500 flex items-center gap-0.5">
                  <Shield className="w-2.5 h-2.5" />
                  {currentUser?.role}
                </span>
              </div>
            </button>

            {userDropdownOpen && (
              <div
                className="absolute right-0 mt-1.5 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-50 text-xs animate-in fade-in zoom-in-95 duration-100"
                onClick={() => setUserDropdownOpen(false)}
              >
                {/* <div className="px-3 py-2 border-b border-slate-100">
                  <div className="font-semibold text-slate-900">{currentUser?.name}</div>
                  <div className="text-slate-500 text-[11px]">@{currentUser?.username}</div>
                  <div className="mt-1 text-[10px] inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                    Role: {currentUser?.role}
                  </div>
                </div> */}

                <button
                  type="button"
                  onClick={logout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 text-left cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main App Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Collapsible Sidebar */}
        <aside
          className={`hidden md:flex flex-col bg-white border-r border-slate-200 transition-all duration-200 shrink-0 ${
            sidebarCollapsed ? 'w-16' : 'w-60'
          }`}
        >
          <div className="flex-1 py-4 overflow-y-auto">
            {navItems.map((group, gIdx) => (
              <div key={gIdx} className="mb-5 px-3">
                {!sidebarCollapsed && (
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1.5">
                    {group.group}
                  </div>
                )}
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentPage === item.id || 
                      (item.id === 'orders' && (currentPage === 'order-detail' || currentPage === 'order-form')) ||
                      (item.id === 'transport' && (currentPage === 'transport-detail' || currentPage === 'transport-form'));

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => navigate(item.id)}
                        title={sidebarCollapsed ? item.label : undefined}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-slate-900 text-white font-semibold shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        } ${sidebarCollapsed ? 'justify-center px-0' : ''}`}
                      >
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                        {!sidebarCollapsed && (
                          <span className="truncate">{item.label}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Sidebar Toggle Bottom */}
          <div className="p-2 border-t border-slate-100 flex items-center justify-end">
            <button
              type="button"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-40 md:hidden flex">
            <div
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-2xs transition-opacity"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white shadow-xl z-50">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
                    V
                  </div>
                  <span className="font-bold text-sm text-slate-900">Vistar ERP</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 p-3 overflow-y-auto space-y-4">
                {navItems.map((group, gIdx) => (
                  <div key={gIdx}>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1">
                      {group.group}
                    </div>
                    <div className="space-y-1">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = currentPage === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => navigate(item.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                              isActive
                                ? 'bg-slate-900 text-white font-semibold'
                                : 'text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <Icon className="w-4 h-4 shrink-0" />
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 border-t border-slate-200 bg-slate-50">
                <div className="flex items-center gap-2.5 mb-2 px-1">
                  <div className="w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-semibold">
                    {currentUser?.name?.charAt(0)}
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-semibold text-slate-900">{currentUser?.name}</div>
                    <div className="text-[10px] text-slate-500">{currentUser?.role}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={logout}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-medium cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content Viewport */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>

      {/* Floating Toast Notification Stack */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-2.5 p-3 rounded-xl shadow-lg border text-xs font-medium animate-in slide-in-from-bottom-2 fade-in duration-150 ${
              toast.type === 'success'
                ? 'bg-emerald-900 text-white border-emerald-800'
                : toast.type === 'error'
                ? 'bg-red-900 text-white border-red-800'
                : 'bg-slate-900 text-white border-slate-800'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : toast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            ) : (
              <Info className="w-4 h-4 text-blue-400 shrink-0" />
            )}
            <span className="flex-1">{toast.text}</span>
            <button
              onClick={() => dismissToast(toast.id)}
              className="p-1 text-slate-300 hover:text-white rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
