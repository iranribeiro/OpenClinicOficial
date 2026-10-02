import React from 'react';
import { Sidebar, type SidebarProps } from './Sidebar.js';
import { Header, type HeaderProps } from './Header.js';
import { Footer } from './Footer.js';
import type { TokenPayload } from '../types/auth.js';
import { useI18n } from '../../i18n/index.js';

export interface MainLayoutProps extends SidebarProps, HeaderProps {
  children: React.ReactNode;
  authError?: string | null;
  claims?: TokenPayload | null;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  activeTab,
  setActiveTab,
  menuLoading,
  canReadOpSchedule,
  canReadOpAttendance,
  canReadOpPatients,
  canReadOpPep,
  canReadOpConsultations,
  canReadOpCashflow,
  canReadOpPayables,
  canReadOpBilling,
  canReadBaseOrganizations,
  canReadBaseProcedures,
  canReadBaseHealthPlans,
  canReadBasePractitioners,
  canReadBaseStaff,
  canReadMgmtIndicators,
  canReadMgmtReports,
  canReadSysSettings,
  canReadSysUsers,
  canReadSysAudit,
  canReadPlatformSettings,
  canReadPlatformTenants,
  canReadPlatformApiKeys,
  canReadPlatformWebhooks,
  canReadPlatformPolicies,
  user,
  claims,
  canReadProfile,
  canReadPassword,
  canReadHelp,
  onSelectTab,
  onLogout,
}) => {
  const { locale } = useI18n();

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        maxHeight: '100vh',
        width: '100vw',
        overflow: 'hidden',
        background: '#0f172a',
      }}
    >
      {/* 1. Sidebar Navigation (Accordion) */}
      <Sidebar
        key={locale}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        menuLoading={menuLoading}
        canReadOpSchedule={canReadOpSchedule}
        canReadOpAttendance={canReadOpAttendance}
        canReadOpPatients={canReadOpPatients}
        canReadOpPep={canReadOpPep}
        canReadOpConsultations={canReadOpConsultations}
        canReadOpCashflow={canReadOpCashflow}
        canReadOpPayables={canReadOpPayables}
        canReadOpBilling={canReadOpBilling}
        canReadBaseOrganizations={canReadBaseOrganizations}
        canReadBaseProcedures={canReadBaseProcedures}
        canReadBaseHealthPlans={canReadBaseHealthPlans}
        canReadBasePractitioners={canReadBasePractitioners}
        canReadBaseStaff={canReadBaseStaff}
        canReadMgmtIndicators={canReadMgmtIndicators}
        canReadMgmtReports={canReadMgmtReports}
        canReadSysSettings={canReadSysSettings}
        canReadSysUsers={canReadSysUsers}
        canReadSysAudit={canReadSysAudit}
        canReadPlatformSettings={canReadPlatformSettings}
        canReadPlatformTenants={canReadPlatformTenants}
        canReadPlatformApiKeys={canReadPlatformApiKeys}
        canReadPlatformWebhooks={canReadPlatformWebhooks}
        canReadPlatformPolicies={canReadPlatformPolicies}
      />

      {/* 2. Main Content Area */}
      <main
        className="main-content-scroll"
        style={{
          flex: 1,
          height: '100vh',
          maxHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          background: '#f8fafc',
          boxSizing: 'border-box',
          padding: '24px 32px 32px 32px',
        }}
      >
        {/* Top Header with User Profile & Dropdown */}
        <Header
          activeTab={activeTab}
          user={user}
          canReadProfile={canReadProfile}
          canReadPassword={canReadPassword}
          canReadHelp={canReadHelp}
          onSelectTab={onSelectTab}
          onLogout={onLogout}
        />

        {/* Dynamic Content */}
        <div style={{ flex: 1 }}>{children}</div>

        {/* Global Layout Footer */}
        <Footer />
      </main>
    </div>
  );
};
