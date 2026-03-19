import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import ToastContainer from './Toast';

const navItems = [
  { path: '/', icon: 'ti-layout-dashboard', key: 'nav_dashboard' },
  { path: '/employees', icon: 'ti-users', key: 'nav_employees' },
  { path: '/clusters', icon: 'ti-map-pin', key: 'nav_clusters' },
  { path: '/routes', icon: 'ti-route', key: 'nav_routes' },
  { path: '/vehicles', icon: 'ti-bus', key: 'nav_vehicles' },
  { path: '/cost-report', icon: 'ti-report-money', key: 'nav_cost_report' },
];

export default function Layout() {
  const { t } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className={`page-wrapper${sidebarOpen ? ' sidebar-open' : ''}`} id="main-wrapper">
      <aside className="left-sidebar">
        <div className="scroll-sidebar">
          <div className="sidebar-brand">
            <NavLink to="/" className="logo">
              <span className="logo-mark">RE</span>
              <span className="logo-text">Routing Engine</span>
            </NavLink>
            <button className="sidebar-close d-xl-none" onClick={() => setSidebarOpen(false)}>
              <i className="ti ti-x" />
            </button>
          </div>

          <nav className="sidebar-nav">
            <ul id="sidebarnav">
              {navItems.map((item) => (
                <li className="sidebar-item" key={item.path}>
                  <NavLink
                    to={item.path}
                    end={item.path === '/'}
                    className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <span className="aside-icon"><i className={`ti ${item.icon}`} /></span>
                    <span className="hide-menu">{t(item.key)}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </aside>

      <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />

      <div className="body-wrapper">
        <button
          className="btn-icon nav-icon mobile-toggle d-lg-none"
          onClick={() => setSidebarOpen(true)}
          style={{ position: 'fixed', top: 16, left: 16, zIndex: 999 }}
        >
          <i className="ti ti-menu-2" />
        </button>

        <div className="container-fluid page-container">
          <Outlet />
        </div>
      </div>

      <ToastContainer />
    </div>
  );
}
