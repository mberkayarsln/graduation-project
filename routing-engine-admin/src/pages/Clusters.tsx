import { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import L from 'leaflet';
import { clustersApi } from '../services/api';
import type { Cluster } from '../services/api';
import SkeletonLoader from '../components/SkeletonLoader';
import { useCity } from '../context/CityContext';

export default function Clusters() {
  const { t } = useTranslation();
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
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
        iconSize: [14, 14], iconAnchor: [7, 7],
      }),
    }).addTo(map).bindPopup(`<b>${t('office')}</b>`);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
  }, [cityConfig, t]);

  const loadClusters = useCallback(async () => {
    setLoading(true);
    try {
      const data = await clustersApi.getAll();
      setClusters(data);
    } catch {
      console.error('Error loading clusters');
    } finally {
      setLoading(false);
    }
  }, []);

  const renderAllOnMap = useCallback(() => {
    if (!layerRef.current || !mapRef.current) return;
    layerRef.current.clearLayers();
    clusters.forEach((c) => {
      const color = c.has_route ? '#10b981' : '#f64e60';
      const icon = L.divIcon({
        className: 'cluster-center',
        html: `<div style="background:${color};color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:11px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);">${c.id}</div>`,
        iconSize: [28, 28], iconAnchor: [14, 14],
      });
      L.marker([c.center[0], c.center[1]], { icon }).addTo(layerRef.current!)
        .bindPopup(`<b>${t('tbl_cluster')} ${c.id}</b><br>${c.employee_count} ${t('lbl_employees')}`);
    });
    if (clusters.length > 0) {
      mapRef.current.fitBounds(clusters.map((c) => [c.center[0], c.center[1]] as [number, number]), { padding: [50, 50] });
    }
  }, [clusters, t]);

  const selectCluster = useCallback(async (index: number) => {
    if (!layerRef.current || !mapRef.current) return;
    setSelectedIdx(index);
    const cluster = clusters[index];
    const color = cluster.has_route ? '#10b981' : '#f64e60';
    layerRef.current.clearLayers();

    try {
      const detail = await clustersApi.getById(cluster.id);
      const icon = L.divIcon({
        className: 'cluster-center',
        html: `<div style="background:${color};color:#fff;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:12px;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);">${cluster.id}</div>`,
        iconSize: [32, 32], iconAnchor: [16, 16],
      });
      L.marker([cluster.center[0], cluster.center[1]], { icon }).addTo(layerRef.current!)
        .bindPopup(`<b>${t('tbl_cluster')} ${cluster.id}</b><br>${cluster.employee_count} ${t('lbl_employees')}`);

      const bounds: [number, number][] = [[cluster.center[0], cluster.center[1]]];
      if (detail.employees) {
        detail.employees.forEach((emp) => {
          const empIcon = L.divIcon({
            className: 'employee-marker',
            html: `<div style="background:${color};width:8px;height:8px;border-radius:50%;border:1px solid #fff;opacity:0.8;"></div>`,
            iconSize: [8, 8], iconAnchor: [4, 4],
          });
          L.marker([emp.lat, emp.lon], { icon: empIcon }).addTo(layerRef.current!).bindPopup(`<b>${emp.name}</b>`);
          bounds.push([emp.lat, emp.lon]);
        });
      }

      if (cluster.has_route && cluster.route_coordinates?.length > 1) {
        L.polyline(cluster.route_coordinates.map((c) => [c[0], c[1]] as [number, number]), { color, weight: 4, opacity: 0.8 }).addTo(layerRef.current!);
      }
      mapRef.current.fitBounds(bounds, { padding: [50, 50] });
    } catch {
      console.error('Error loading cluster details');
    }
  }, [clusters, t]);

  useEffect(() => {
    initMap();
    clustersApi.getAll().then(data => { setClusters(data); setLoading(false); }).catch(() => { console.error('Error loading clusters'); setLoading(false); });
  }, [initMap]);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setView(cityConfig.mapCenter, cityConfig.zoom);
    officeMarkerRef.current?.setLatLng(cityConfig.office);
  }, [cityConfig]);

  useEffect(() => { if (selectedIdx < 0) renderAllOnMap(); }, [renderAllOnMap, selectedIdx]);

  return (
    <>
      <div className="page-title-bar">
        <div className="title-wrap">
          <h1 className="page-title">{t('cls_title')}</h1>
          <p className="page-subtitle">{t('sub_clusters')}</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={() => { setSelectedIdx(-1); loadClusters(); }}>{t('btn_refresh')}</button>
        </div>
      </div>

      <div className="page-content">
        <div className="clusters-layout" style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: 20, height: 'calc(100vh - 140px)' }}>
          <div className="clusters-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
            <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div className="card-header">
                <h2>{t('sidebar_all_cls')}</h2>
                <span className="badge">{clusters.length}</span>
              </div>
              <div className="card-body" style={{ overflowY: 'auto', flex: 1, padding: 0 }}>
                {loading ? (
                  <SkeletonLoader variant="list-item" count={6} />
                ) : clusters.length === 0 ? (
                  <div className="empty" style={{ padding: 20 }}>{t('msg_no_cls')}</div>
                ) : (
                  clusters.map((c, i) => (
                    <div key={c.id} className={`cluster-item${selectedIdx === i ? ' selected' : ''}`} onClick={() => selectCluster(i)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 15px', borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}>
                      <div style={{ background: c.has_route ? '#10b981' : '#f64e60', width: 12, height: 12, borderRadius: '50%' }} />
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t('tbl_cluster')} {c.id}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.employee_count} {t('lbl_employees')} | {t('tbl_zone')} {c.zone_id ?? '-'}</span>
                      </div>
                      <span className={`cluster-badge ${c.has_route ? 'has-route' : 'no-route'}`}
                        style={{ padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500, background: c.has_route ? 'rgba(16,185,129,0.2)' : 'rgba(246,78,96,0.2)', color: c.has_route ? '#10b981' : '#f64e60' }}>
                        {c.has_route ? t('badge_route') : t('badge_no_route')}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="card" style={{ height: '100%', minHeight: 500 }}>
            <div className="card-header">
              <h2>{selectedIdx >= 0 ? `${t('tbl_cluster')} ${clusters[selectedIdx]?.id}` : t('sidebar_all_cls')}</h2>
            </div>
            <div ref={mapContainerRef} style={{ height: '100%', borderRadius: 4 }} />
          </div>
        </div>
      </div>
    </>
  );
}
