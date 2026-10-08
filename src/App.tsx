import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AppShell } from './components/layout/AppShell';
import { LoginScreen } from './components/auth/LoginScreen';
import { DashboardScreen } from './components/dashboard/DashboardScreen';
import { OrderListScreen } from './components/orders/OrderListScreen';
import { OrderDetailScreen } from './components/orders/OrderDetailScreen';
import { OrderFormScreen } from './components/orders/OrderFormScreen';
import { TransportListScreen } from './components/transport/TransportListScreen';
import { TransportPaymentsScreen } from './components/transport/TransportPaymentsScreen';
import { TransportDetailScreen } from './components/transport/TransportDetailScreen';
import { TransportFormScreen } from './components/transport/TransportFormScreen';
import { BulkTransportScreen } from './components/transport/BulkTransportScreen';
import { BulkTransportListScreen } from './components/transport/BulkTransportListScreen';
import { MasterDataScreen } from './components/master/MasterDataScreen';
import { EmployeeScreen } from './components/employees/EmployeeScreen';
import { ExpenseBillScreen } from './components/expenses/ExpenseBillScreen';

const MainRouter: React.FC = () => {
  const { currentUser, currentPage } = useApp();

  if (!currentUser) {
    return <LoginScreen />;
  }

  return (
    <AppShell>
      {currentPage === 'dashboard' && <DashboardScreen />}
      {currentPage === 'orders' && <OrderListScreen />}
      {currentPage === 'order-detail' && <OrderDetailScreen />}
      {currentPage === 'order-form' && <OrderFormScreen />}
      {currentPage === 'transport' && <TransportListScreen />}
      {currentPage === 'transport-payments' && <TransportPaymentsScreen />}
      {currentPage === 'transport-detail' && <TransportDetailScreen />}
      {currentPage === 'transport-form' && <TransportFormScreen />}
      {currentPage === 'bulk-transport-list' && <BulkTransportListScreen />}
      {currentPage === 'bulk-transport' && <BulkTransportScreen />}
      {currentPage === 'master-data' && <MasterDataScreen />}
      {currentPage === 'expenses' && <ExpenseBillScreen />}
      {currentPage === 'employees' && <EmployeeScreen />}
    </AppShell>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainRouter />
    </AppProvider>
  );
}
