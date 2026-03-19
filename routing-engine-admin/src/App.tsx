import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import Clusters from './pages/Clusters';
import RoutesPage from './pages/Routes';
import RouteEdit from './pages/RouteEdit';
import Vehicles from './pages/Vehicles';
import CostReport from './pages/CostReport';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/clusters" element={<Clusters />} />
          <Route path="/routes" element={<RoutesPage />} />
          <Route path="/routes/edit" element={<RouteEdit />} />
          <Route path="/vehicles" element={<Vehicles />} />
          <Route path="/cost-report" element={<CostReport />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
