import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext.jsx';
import Login from './pages/Login.jsx';
import ForcePasswordChange from './pages/ForcePasswordChange.jsx';
import ConfirmAccount from './pages/ConfirmAccount.jsx';
import UserManagement from './pages/UserManagement.jsx';
import FormulesManagement from './pages/FormulesManagement.jsx';
import AbonnementsManagement from './pages/AbonnementsManagement.jsx';
import AbonnementDetail from './pages/AbonnementDetail.jsx';
import AbonnementStats from './pages/AbonnementStats.jsx';
import ProfileSettings from './pages/ProfileSettings.jsx';
import DashboardLayout from './components/DashboardLayout.jsx';
import ScanValidation from './pages/ScanValidation.jsx';
import TitresManagement from './pages/TitresManagement.jsx';
import ValidationsHistory from './pages/ValidationsHistory.jsx';
import AuditLogs from './pages/AuditLogs.jsx';
import BilletterieStats from './pages/BilletterieStats.jsx';
import EspaceClient from './pages/EspaceClient.jsx';

function App() {
  return (
    <ThemeProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/change-password" element={<ForcePasswordChange />} />
          <Route path="/confirmation/:token" element={<ConfirmAccount />} />

          {/* Protected Dashboard Layout */}
          <Route path="/" element={<DashboardLayout />}>
            <Route index element={<Navigate to="/stats" replace />} />

            {/* Service Utilisateurs */}
            <Route path="users" element={<UserManagement />} />
            <Route path="profile" element={<ProfileSettings />} />

            {/* Service Abonnements */}
            <Route path="formules" element={<FormulesManagement />} />
            <Route path="abonnements" element={<AbonnementsManagement />} />
            <Route path="abonnements/:id" element={<AbonnementDetail />} />
            <Route path="stats" element={<AbonnementStats />} />
            <Route path="subscriptions" element={<Navigate to="/abonnements" replace />} />

            {/* Service Billetterie (QR Code, Contrôle, Audit, Stats) */}
            <Route path="scan" element={<ScanValidation />} />
            <Route path="titres" element={<TitresManagement />} />
            <Route path="validations" element={<ValidationsHistory />} />
            <Route path="audit" element={<AuditLogs />} />
            <Route path="billetterie-stats" element={<BilletterieStats />} />
            <Route path="mes-titres" element={<EspaceClient />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
