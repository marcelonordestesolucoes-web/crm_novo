import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import Dashboard  from '@/views/Dashboard/Dashboard';
import Pipeline   from '@/views/Pipeline/Pipeline';
import Companies  from '@/views/Companies/Companies';
import Contacts   from '@/views/Contacts/Contacts';
import Tasks      from '@/views/Tasks/Tasks';
import Analytics  from '@/views/Analytics/Analytics';
import SettingsView from '@/views/Settings/SettingsView';
import Login      from '@/views/Auth/Login';
import { ROUTES } from '@/constants/config';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Route */}
          <Route path="/login" element={<Login />} />

          {/* Protected Routes */}
          <Route path="/*" element={
            <ProtectedRoute>
              <MainLayout>
                <Routes>
                  <Route path={ROUTES.HOME}      element={<Dashboard />} />
                  <Route path={ROUTES.PIPELINE}  element={<Pipeline />} />
                  <Route path={ROUTES.EMPRESAS}  element={<Companies />} />
                  <Route path={ROUTES.CONTATOS}  element={<Contacts />} />
                  <Route path={ROUTES.TAREFAS}   element={<Tasks />} />
                  <Route path={ROUTES.ANALYTICS} element={<Analytics />} />
                  <Route path={ROUTES.CONFIGURACOES} element={<SettingsView />} />
                  <Route path="*"                element={<Navigate to={ROUTES.HOME} replace />} />
                </Routes>
              </MainLayout>
            </ProtectedRoute>
          } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
