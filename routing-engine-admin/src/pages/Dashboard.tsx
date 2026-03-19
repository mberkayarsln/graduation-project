import { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import L from 'leaflet';
import { statsApi, routesApi, generateRoutes, getOptimizationMode } from '../services/api';
import type { Stats, Route } from '../services/api';
import { showToast } from '../utils/toast';
import SkeletonLoader from '../components/SkeletonLoader';

const OFFICE = [40.837384, 29.412109] as [number, number];
const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];

export default function Dashboard() {
  const { t } = useTranslation();
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [mode, setMode] = useState('balanced');
  const [generating, setGenerating] = useState(false);

  const initMap = useCallback(() => {
    if (mapRef.current || !mapContainerRef.current) return;
    const map = L.map(mapContainerRef.current).setView([40.95, 29.2], 11);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap, &copy; CARTO',
    }).addTo(map);

    const officeIcon = L.divIcon({
      className: 'custom-marker office-marker',
      html: `<div style="background:#3699ff;width:20px;height:20px;border-radius:6px;border:1px solid #fff;display:flex;align-items:center;justify-content:center;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/></svg>
      </div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
    L.marker(OFFICE, { icon: officeIcon }).addTo(map).bindPopup(`<b>${t('office')}</b>`);

    routeLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
  }, [t]);

  const loadRoutes = useCallback(async () => {
    if (!routeLayerRef.current) return;
    routeLayerRef.current.clearLayers();
    try {
      const routes: Route[] = await routesApi.getAll();
      routes.forEach((route, i) => {
        const color = COLORS[i % COLORS.length];
        const coords = route.coordinates?.length > 1 ? route.coordinates : route.stops;
        if (coords?.length > 1) {
          L.polyline(coords.map((s) => [s[0], s[1]] as [number, number]), { color, weight: 3, opacity: 0.8 }).addTo(routeLayerRef.current!);
        }
        if (route.center) {
          const icon = L.divIcon({
            className: 'custom-marker cluster-marker',
            html: `<div style="background:${color};width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:bold;">${i + 1}</div>`,
            iconSize: [20, 20],
          });
          L.marker([route.center[0], route.center[1]], { icon })
            .addTo(routeLayerRef.current!)
            .bindPopup(`<b>${t('route_name_fmt', { num: i + 1 })}</b><br>${t('dtl_distance')}: ${route.distance_km} ${t('unit_km')}<br>${t('dtl_duration')}: ${Math.round(route.duration_min)} ${t('unit_min')}`);
        }
      });
    } catch (err) {
      console.error('Error loading routes:', err);
    }
  }, [t]);

  const refreshStats = useCallback(async () => {
    try {
      const data = await statsApi.get();
      setStats(data);
      loadRoutes();
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  }, [loadRoutes]);

  const handleGenerate = async () => {
    setGenerating(true);
    showToast(t('msg_generating'), 'info');
    try {
      const data = await generateRoutes(mode);
      if (data.success) {
        await refreshStats();
        showToast(t('msg_gen_success'), 'success');
      } else {
        showToast(t('msg_gen_error'), 'error');
      }
    } catch {
      showToast(t('msg_gen_error'), 'error');
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    initMap();
    refreshStats();
    getOptimizationMode().then((data) => setMode(data.current_mode)).catch(() => {});
  }, [initMap, refreshStats]);

  const efficiency = stats && stats.active_employees > 0
    ? (((stats.active_employees - stats.unassigned_employees) / stats.active_employees) * 100).toFixed(1) + '%'
    : '--';

  const statCards = [
    { icon: 'ti-users', bg: '#E3F2FD', color: '#1565C0', label: t('stat_employees'), value: stats?.total_employees ?? '--' },
    { icon: 'ti-user-check', bg: '#E8F5E9', color: '#2E7D32', label: t('stat_active_emp'), value: stats?.active_employees ?? '--' },
    { icon: 'ti-user-exclamation', bg: '#FFF3E0', color: '#E65100', label: t('lbl_unassigned'), value: stats?.unassigned_employees ?? '--' },
    { icon: 'ti-chart-line', bg: '#F3E5F5', color: '#7B1FA2', label: t('lbl_efficiency'), value: efficiency },
    { icon: 'ti-route', bg: '#E8F5E9', color: '#2E7D32', label: t('stat_routes'), value: stats?.total_routes ?? '--' },
    { icon: 'ti-bus', bg: '#E3F2FD', color: '#1565C0', label: t('stat_vehicles'), value: stats?.total_vehicles ?? '--' },
    { icon: 'ti-components', bg: '#FFF3E0', color: '#E65100', label: t('nav_clusters'), value: stats?.total_clusters ?? '--' },
    { icon: 'ti-map-pin', bg: '#E8F5E9', color: '#2E7D32', label: t('tbl_zone'), value: stats?.total_zones ?? '--' },
    { icon: 'ti-ruler-measure', bg: '#E3F2FD', color: '#1565C0', label: t('stat_distance'), value: stats?.total_distance_km ?? '--' },
    { icon: 'ti-clock', bg: '#F3E5F5', color: '#7B1FA2', label: t('stat_duration'), value: stats ? Math.round(stats.total_duration_min) : '--' },
  ];

  return (
    <>
      <div className="page-title-bar">
        <div className="title-wrap">
          <h1 className="page-title">{t('dashboard_title')}</h1>
          <p className="page-subtitle">{t('sub_dashboard')}</p>
        </div>
        <div className="header-actions">
          <select id="optimization-mode" value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="budget">{t('opt_budget')}</option>
            <option value="balanced">{t('opt_balanced')}</option>
            <option value="employee">{t('opt_employee')}</option>
          </select>
          <button className="btn btn-icon" onClick={refreshStats} title={t('btn_refresh')}>
            <i className="ti ti-refresh" />
          </button>
          <button className="btn btn-primary" onClick={handleGenerate} disabled={generating}>
            <i className="ti ti-plus" style={{ marginRight: 6 }} />
            {generating ? t('msg_generating') : t('btn_generate')}
          </button>
        </div>
      </div>

      <div className="page-content">
        <div className="dashboard-layout">
          <div>
            <div className="card" style={{ marginBottom: 0 }}>
              <div ref={mapContainerRef} style={{ height: 600, borderRadius: 12, zIndex: 1 }} />
            </div>
          </div>

          <div>
            <div className="section-label">{t('lbl_ops_summary')}</div>
            <div className="stats-grid">
              {stats ? statCards.map((s, i) => (
                <div className="stat-card" key={i}>
                  <div className="stat-info">
                    <div className="stat-icon" style={{ background: s.bg, color: s.color }}>
                      <i className={`ti ${s.icon}`} />
                    </div>
                    <span className="stat-label">{s.label}</span>
                  </div>
                  <span className="stat-value">{s.value}</span>
                </div>
              )) : <SkeletonLoader variant="stat-card" count={10} />}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
