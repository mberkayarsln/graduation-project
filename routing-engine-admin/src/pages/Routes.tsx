import { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import L from 'leaflet';
import { routesApi, clustersApi, getStopNames } from '../services/api';
import type { Route } from '../services/api';
import SkeletonLoader from '../components/SkeletonLoader';


const OFFICE = [40.837384, 29.412109] as [number, number];
const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#FF9FF3', '#54A0FF'];

export default function RoutesPage() {
  const { t } = useTranslation();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const [detailIdx, setDetailIdx] = useState(-1);
  const [empNames, setEmpNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const currentLayerRef = useRef<L.LayerGroup | null>(null);
  const bgPolylinesRef = useRef<L.Polyline[]>([]);

  const initMap = useCallback(() => {
    if (mapRef.current || !mapContainerRef.current) return;
    const map = L.map(mapContainerRef.current).setView([40.95, 29.2], 11);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap, &copy; CARTO',
    }).addTo(map);
    L.marker(OFFICE, {
      icon: L.divIcon({ className: 'office-icon', html: '<div style="background:#6366f1;width:12px;height:12px;border-radius:50%;border:2px solid #fff;"></div>', iconSize: [12, 12] }),
    }).addTo(map).bindPopup(`<b>${t('office')}</b>`);
    mapRef.current = map;
  }, [t]);

  const renderBgPolylines = useCallback(() => {
    if (!mapRef.current) return;
    bgPolylinesRef.current.forEach((p) => mapRef.current!.removeLayer(p));
    bgPolylinesRef.current = [];
    routes.forEach((route, i) => {
      const color = COLORS[i % COLORS.length];
      const coords = route.coordinates?.length > 1 ? route.coordinates : route.stops;
      if (coords?.length > 1) {
        const polyline = L.polyline(coords.map((s) => [s[0], s[1]] as [number, number]), { color, weight: 3, opacity: 0.6 }).addTo(mapRef.current!);
        polyline.on('click', () => showDetails(i));
        polyline.on('mouseover', function (this: L.Polyline) { this.setStyle({ weight: 6, opacity: 1 }); });
        polyline.on('mouseout', function (this: L.Polyline) { if (selectedIdx !== i) this.setStyle({ weight: 3, opacity: 0.6 }); });
        bgPolylinesRef.current.push(polyline);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routes]);

  const loadRoutes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await routesApi.getAll(true);
      setRoutes(data);
    } catch {
      console.error('Error loading routes');
    } finally {
      setLoading(false);
    }
  }, []);

  const selectRoute = useCallback((index: number) => {
    if (!mapRef.current) return;
    setSelectedIdx(index);
    const route = routes[index];
    const color = COLORS[index % COLORS.length];

    bgPolylinesRef.current.forEach((p) => p.setStyle({ weight: 3, opacity: 0.6 }));
    if (bgPolylinesRef.current[index]) bgPolylinesRef.current[index].setStyle({ weight: 6, opacity: 1 });

    if (currentLayerRef.current) mapRef.current.removeLayer(currentLayerRef.current);
    currentLayerRef.current = L.layerGroup().addTo(mapRef.current);

    const coords = route.coordinates?.length > 1 ? route.coordinates : route.stops;
    if (coords?.length > 1) {
      const latlngs = coords.map((s) => [s[0], s[1]] as [number, number]);
      L.polyline(latlngs, { color, weight: 5, opacity: 1 }).addTo(currentLayerRef.current);
      mapRef.current.fitBounds(latlngs);
    }

    route.stops.forEach((stop, i) => {
      let html: string;
      if (i === 0) html = '<div style="background:#10b981;width:12px;height:12px;border-radius:50%;border:2px solid #fff;"></div>';
      else if (i === route.stops.length - 1) html = '<div style="background:#6366f1;width:12px;height:12px;border-radius:50%;border:2px solid #fff;"></div>';
      else html = `<div style="background:${color};width:10px;height:10px;border-radius:50%;border:2px solid #fff;"></div>`;
      const icon = L.divIcon({ className: 'stop', html, iconSize: [12, 12], iconAnchor: [6, 6] });
      L.marker([stop[0], stop[1]], { icon }).addTo(currentLayerRef.current!).bindPopup(`Stop ${i + 1}`);
    });

    if (route.bus_stops?.length > 0) {
      const markers: { marker: L.Marker; stop: [number, number] }[] = [];
      route.bus_stops.forEach((stop, i) => {
        const busIcon = L.divIcon({
          className: 'bus-stop',
          html: '<div style="background:#f59e0b;width:8px;height:8px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 4px rgba(245,158,11,0.6);"></div>',
          iconSize: [8, 8], iconAnchor: [4, 4],
        });
        const marker = L.marker([stop[0], stop[1]], { icon: busIcon }).addTo(currentLayerRef.current!).bindPopup(`Bus Stop ${i + 1}`);
        markers.push({ marker, stop });
      });
      getStopNames(route.bus_stops).then((names) => {
        markers.forEach(({ marker, stop }, i) => {
          const key = `${stop[0].toFixed(5)},${stop[1].toFixed(5)}`;
          const name = names[key] || 'Bus Stop';
          marker.setPopupContent(`<b>${name}</b><br>${markers.length} stops, #${i + 1}`);
        });
      }).catch(() => {});
    }
  }, [routes]);

  const showDetails = useCallback(async (index: number) => {
    selectRoute(index);
    setDetailIdx((prev) => (prev === index ? -1 : index));
    const route = routes[index];
    try {
      const cluster = await clustersApi.getById(route.cluster_id);
      setEmpNames(cluster.employees?.map((e) => e.name) || []);
    } catch {
      setEmpNames([]);
    }
  }, [routes, selectRoute]);

  useEffect(() => { initMap(); loadRoutes(); }, [initMap, loadRoutes]);
  useEffect(() => { renderBgPolylines(); }, [renderBgPolylines]);

  return (
    <>
      <div className="page-title-bar">
        <div className="title-wrap">
          <h1 className="page-title">{t('rte_title')}</h1>
          <p className="page-subtitle">{t('sub_routes')}</p>
        </div>
      </div>

      <div className="page-content">
        <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 20, height: 'calc(100vh - 140px)' }}>
          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
            <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div className="card-header">
                <h2>{t('sidebar_all_rte')}</h2>
                <span className="badge">{routes.length}</span>
              </div>
              <div className="card-body" style={{ overflowY: 'auto', flex: 1, padding: 0 }}>
                {loading ? (
                  <SkeletonLoader variant="list-item" count={6} />
                ) : routes.length === 0 ? (
                  <div className="empty" style={{ padding: 20 }}>{t('msg_no_rte')}</div>
                ) : (
                  routes.map((r, i) => (
                    <div key={r.cluster_id}>
                      <div className={`route-item${selectedIdx === i ? ' selected' : ''}`}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 15px', borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}>
                        <div style={{ background: COLORS[i % COLORS.length], width: 10, height: 10, borderRadius: '50%' }} />
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, cursor: 'pointer' }} onClick={() => selectRoute(i)}>
                          <span style={{ fontWeight: 600 }}>{t('route_name_fmt', { num: i + 1 })}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {r.distance_km} {t('unit_km')} | {Math.round(r.duration_min)} {t('unit_min')} | {r.employee_count} {t('lbl_employees')}
                          </span>
                        </div>
                        <button className="btn btn-sm btn-secondary" onClick={() => showDetails(i)}>{t('btn_details')}</button>
                      </div>
                      {detailIdx === i && (
                        <div style={{ padding: 15, borderTop: '1px solid var(--border-color)', background: 'var(--bg-body)' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 15, marginBottom: 15 }}>
                            <div><span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('dtl_distance')}</span><div style={{ fontSize: 16, fontWeight: 600 }}>{r.distance_km} {t('unit_km')}</div></div>
                            <div><span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('dtl_duration')}</span><div style={{ fontSize: 16, fontWeight: 600 }}>{Math.round(r.duration_min)} {t('unit_min')}</div></div>
                            <div><span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('dtl_stops')}</span><div style={{ fontSize: 16, fontWeight: 600 }}>{r.stop_count}</div></div>
                          </div>
                          <div>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('dtl_employees')}</span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                              {empNames.map((name) => (
                                <span key={name} style={{ padding: '4px 8px', background: 'var(--bg-card)', borderRadius: 3, fontSize: 11, color: 'var(--text-secondary)' }}>{name}</span>
                              ))}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 15, paddingTop: 15, borderTop: '1px solid var(--border-color)' }}>
                            <a className="btn btn-sm btn-primary" href={`/routes/edit?cluster=${r.cluster_id}`}>{t('btn_edit_route')}</a>
                            <button className="btn btn-sm btn-secondary" onClick={() => setDetailIdx(-1)}>{t('btn_close')}</button>
                          </div>
                          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>{t('help_drag')}</p>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Map */}
          <div className="card" style={{ height: '100%', minHeight: 500 }}>
            <div className="card-header">
              <h2>{selectedIdx >= 0 ? t('route_name_fmt', { num: selectedIdx + 1 }) : t('map_select_rte')}</h2>
            </div>
            <div ref={mapContainerRef} style={{ height: '100%', borderRadius: 4 }} />
          </div>
        </div>
      </div>
    </>
  );
}
