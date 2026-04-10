import { useEffect, useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, Link } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet-routing-machine';
import { routesApi, clustersApi } from '../services/api';
import type { Route } from '../services/api';
import { showToast } from '../utils/toast';
import { useCity } from '../context/CityContext';

const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#FF9FF3', '#54A0FF'];

export default function RouteEditPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [currentIdx, setCurrentIdx] = useState(-1);
  const [distance, setDistance] = useState('--');
  const [duration, setDuration] = useState('--');
  const [waypointCount, setWaypointCount] = useState('--');

  const [saving, setSaving] = useState(false);

  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const routingRef = useRef<L.Routing.Control | null>(null);
  const originalWaypointsRef = useRef<L.LatLng[]>([]);
  const empMarkersRef = useRef<L.Marker[]>([]);
  const lastRouteRef = useRef<L.Routing.IRoute | null>(null);
  const officeMarkerRef = useRef<L.Marker | null>(null);
  const { cityConfig } = useCity();

  const initMap = useCallback(() => {
    if (mapRef.current || !mapContainerRef.current) return;
    const map = L.map(mapContainerRef.current).setView(cityConfig.mapCenter, cityConfig.zoom);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap, &copy; CARTO',
    }).addTo(map);
    officeMarkerRef.current = L.marker(cityConfig.office, {
      icon: L.divIcon({
        className: 'office-icon',
        html: '<div style="background:#6366f1;width:14px;height:14px;border-radius:50%;border:2px solid #fff;"></div>',
        iconSize: [14, 14],
      }),
    }).addTo(map).bindPopup(`<b>${t('office')}</b>`);
    mapRef.current = map;
  }, [cityConfig, t]);

  const loadRouteForEdit = useCallback(async (index: number) => {
    if (!mapRef.current || index < 0 || index >= routes.length) return;
    const route = routes[index];
    const color = COLORS[index % COLORS.length];
    setCurrentIdx(index);

    // Clean previous
    if (routingRef.current) { mapRef.current.removeControl(routingRef.current); routingRef.current = null; }
    empMarkersRef.current.forEach((m) => mapRef.current!.removeLayer(m));
    empMarkersRef.current = [];

    const waypoints = route.stops.map((s) => L.latLng(s[0], s[1]));
    originalWaypointsRef.current = waypoints.map((wp) => L.latLng(wp.lat, wp.lng));

    const control = L.Routing.control({
      router: L.Routing.osrmv1({ serviceUrl: 'http://localhost:5001/route/v1' }),
      waypoints,
      routeWhileDragging: true,
      draggableWaypoints: true,
      addWaypoints: true,
      fitSelectedRoutes: true,
      showAlternatives: false,
      lineOptions: { styles: [{ color, opacity: 0.9, weight: 6 }], extendToWaypoints: true, missingRouteTolerance: 0 },
      createMarker(i: number, waypoint: { latLng: L.LatLng }) {
        const isOffice = Math.abs(waypoint.latLng.lat - cityConfig.office[0]) < 0.001 && Math.abs(waypoint.latLng.lng - cityConfig.office[1]) < 0.001;
        if (isOffice) {
          return L.marker(waypoint.latLng, {
            draggable: true,
            icon: L.divIcon({ className: 'custom-marker', html: '<div style="background:#6366f1;width:16px;height:16px;border-radius:50%;border:3px solid #fff;"></div>', iconSize: [16, 16], iconAnchor: [8, 8] }),
          }).bindPopup('<b>Ofis</b>');
        }
        return L.marker(waypoint.latLng, {
          draggable: true,
          icon: L.divIcon({
            className: 'custom-marker',
            html: `<div style="background:${color};color:white;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:11px;border:2px solid white;">${i + 1}</div>`,
            iconSize: [24, 24], iconAnchor: [12, 12],
          }),
        }).bindPopup(`<b>Durak ${i + 1}</b><br>Taşımak için sürükleyin`);
      },
    }).addTo(mapRef.current);

    control.on('routesfound', (e: L.Routing.RoutingEvent) => {
      const found = e.routes[0];
      lastRouteRef.current = found;
      const s = found.summary;
      setDistance(`${(s.totalDistance / 1000).toFixed(2)} km`);
      setDuration(`${Math.round(s.totalTime / 60)} dk`);
      setWaypointCount(String(control.getWaypoints().filter((wp) => wp.latLng).length));
    });

    routingRef.current = control;

    // Initial info
    setDistance(`${route.distance_km} km`);
    setDuration(`${Math.round(route.duration_min)} dk`);
    setWaypointCount(String(route.stop_count));

    // Load employee markers
    try {
      const cluster = await clustersApi.getById(route.cluster_id);
      cluster.employees?.forEach((emp) => {
        const marker = L.marker([emp.lat, emp.lon], {
          icon: L.divIcon({
            className: 'employee-marker',
            html: '<div style="background:#f64e60;width:8px;height:8px;border-radius:50%;border:2px solid #fff;"></div>',
            iconSize: [8, 8], iconAnchor: [4, 4],
          }),
        }).addTo(mapRef.current!).bindPopup(`<b>${emp.name}</b>`);
        empMarkersRef.current.push(marker);
      });
    } catch { /* ignore */ }
  }, [cityConfig.office, routes]);

  const addWaypoint = () => {
    if (!routingRef.current || !mapRef.current) return;
    const center = mapRef.current.getCenter();
    const wps = routingRef.current.getWaypoints();
    const newWps = [...wps.slice(0, -1), { latLng: L.latLng(center.lat, center.lng) } as L.Routing.Waypoint, wps[wps.length - 1]];
    routingRef.current.setWaypoints(newWps.map((wp) => wp.latLng || L.latLng(0, 0)));
    showToast(t('msg_wp_added') || 'Waypoint added');
  };

  const resetRoute = () => {
    if (!routingRef.current) return;
    routingRef.current.setWaypoints(originalWaypointsRef.current);
    showToast(t('msg_route_reset') || 'Route reset');
  };

  const saveRoute = async () => {
    if (!routingRef.current || currentIdx < 0) return;
    setSaving(true);
    showToast(t('msg_route_saving'), 'info');
    const wps = routingRef.current.getWaypoints().filter((wp) => wp.latLng).map((wp) => [wp.latLng!.lat, wp.latLng!.lng] as [number, number]);
    let coordinates: [number, number][] = [];
    let dist = 0;
    let dur = 0;
    if (lastRouteRef.current) {
      coordinates = lastRouteRef.current.coordinates.map((c) => [c.lat, c.lng] as [number, number]);
      dist = parseFloat((lastRouteRef.current.summary.totalDistance / 1000).toFixed(2));
      dur = Math.round(lastRouteRef.current.summary.totalTime / 60);
    }
    const route = routes[currentIdx];
    try {
      await routesApi.update(route.cluster_id, { stops: wps, coordinates, distance_km: dist, duration_min: dur });
      showToast(t('msg_route_saved'), 'success');
      originalWaypointsRef.current = wps.map((s: number[]) => L.latLng(s[0], s[1]));
    } catch {
      showToast(t('msg_route_save_err'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const exportRoute = () => {
    if (!routingRef.current || currentIdx < 0) return;
    const wps = routingRef.current.getWaypoints().filter((wp) => wp.latLng).map((wp) => ({ lat: wp.latLng!.lat, lon: wp.latLng!.lng }));
    const route = routes[currentIdx];
    const data = { cluster_id: route.cluster_id, waypoints: wps, exported_at: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `route_${route.cluster_id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(t('msg_route_exported') || 'Route exported!');
  };

  useEffect(() => { initMap(); }, [initMap]);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setView(cityConfig.mapCenter, cityConfig.zoom);
    officeMarkerRef.current?.setLatLng(cityConfig.office);
  }, [cityConfig]);

  useEffect(() => {
    routesApi.getAll().then((data) => {
      setRoutes(data);
    }).catch(() => {});
  }, []);

  // Auto-select route from query param
  const autoSelectDone = useRef(false);
  useEffect(() => {
    if (routes.length === 0 || autoSelectDone.current) return;
    const clusterId = searchParams.get('cluster');
    if (clusterId) {
      const idx = routes.findIndex((r) => String(r.cluster_id) === clusterId);
      if (idx >= 0) {
        autoSelectDone.current = true;
        loadRouteForEdit(idx);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routes]);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const idx = parseInt(e.target.value);
    if (!isNaN(idx)) loadRouteForEdit(idx);
  };

  return (
    <>
      <div className="page-title-bar">
        <div className="title-wrap">
          <h1 className="page-title">{t('edit_title')}</h1>
        </div>
        <div className="header-actions">
          <Link to="/routes" className="btn btn-secondary">{t('btn_back')}</Link>
        </div>
      </div>

      <div className="page-content">
        <div className="edit-layout" style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, height: 'calc(100vh - 140px)' }}>
          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card">
              <div className="card-header"><h2>{t('panel_select')}</h2></div>
              <div className="card-body">
                <select value={currentIdx >= 0 ? currentIdx : ''} onChange={handleSelectChange} style={{ width: '100%', padding: '8px 12px', borderRadius: 4, border: '1px solid var(--border-color)' }}>
                  <option value="">{t('opt_select_ph')}</option>
                  {routes.map((r, i) => (
                    <option key={r.cluster_id} value={i}>
                      {t('route_name_fmt', { num: i + 1 })} - {r.distance_km} {t('unit_km')}, {Math.round(r.duration_min)} {t('unit_min')}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {currentIdx >= 0 && (
              <>
                <div className="card">
                  <div className="card-header"><h2>{t('panel_info')}</h2></div>
                  <div className="card-body">
                    <div className="info-stat" style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{t('dtl_distance')}</span>
                      <span style={{ fontWeight: 600 }}>{distance}</span>
                    </div>
                    <div className="info-stat" style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{t('dtl_duration')}</span>
                      <span style={{ fontWeight: 600 }}>{duration}</span>
                    </div>
                    <div className="info-stat" style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{t('lbl_waypoints')}</span>
                      <span style={{ fontWeight: 600 }}>{waypointCount}</span>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div className="card-header"><h2>{t('panel_actions')}</h2></div>
                  <div className="card-body">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={addWaypoint}>{t('btn_add_wp')}</button>
                      <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={resetRoute}>{t('btn_reset')}</button>
                      <button className="btn btn-success" style={{ width: '100%', justifyContent: 'center', background: 'var(--color-success)', color: 'white' }} onClick={saveRoute} disabled={saving}>{saving ? t('msg_route_saving') : t('btn_save')}</button>
                      <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={exportRoute}>{t('btn_export')}</button>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10, padding: 10, background: 'var(--bg-body)', borderRadius: 4 }}>
                      {t('help_edit')}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Map */}
          <div className="card" style={{ height: '100%', minHeight: 500 }}>
            <div ref={mapContainerRef} style={{ height: '100%', borderRadius: 4 }} />
          </div>
        </div>
      </div>
    </>
  );
}
