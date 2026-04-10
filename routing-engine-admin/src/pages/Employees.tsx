import { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import L from 'leaflet';
import { employeesApi } from '../services/api';
import type { Employee } from '../services/api';
import { showToast } from '../utils/toast';
import SkeletonLoader from '../components/SkeletonLoader';
import { useCity } from '../context/CityContext';

export default function Employees() {
  const { t } = useTranslation();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const markersRef = useRef<Record<number, L.Marker>>({});
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
        className: 'office-marker',
        html: `<div style="background:#3699ff;width:20px;height:20px;border-radius:6px;border:1px solid #fff;display:flex;align-items:center;justify-content:center;"><svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/></svg></div>`,
        iconSize: [20, 20], iconAnchor: [10, 10],
      }),
    }).addTo(map).bindPopup(`<b>${t('office')}</b>`);
    markerLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
  }, [cityConfig, t]);

  const renderMarkers = useCallback(() => {
    if (!markerLayerRef.current) return;
    markerLayerRef.current.clearLayers();
    markersRef.current = {};
    employees.forEach((e) => {
      const isSelected = selected.has(e.id);
      let color = '#10b981';
      if (isSelected) color = '#3699ff';
      else if (e.excluded) color = '#f64e60';
      else if (!e.has_route) color = '#8b5cf6';
      const size = isSelected ? 12 : 8;
      const marker = L.marker([e.lat, e.lon], {
        icon: L.divIcon({
          className: 'employee-marker',
          html: `<div style="background:${color};width:${size}px;height:${size}px;border-radius:50%;border:${isSelected ? '2' : '1'}px solid #fff;cursor:pointer;"></div>`,
          iconSize: [size, size], iconAnchor: [size / 2, size / 2],
        }),
      }).addTo(markerLayerRef.current!);
      marker.on('click', () => {
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(e.id)) next.delete(e.id);
          else next.add(e.id);
          return next;
        });
      });
      markersRef.current[e.id] = marker;
    });
  }, [employees, selected]);

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const data = await employeesApi.getAll();
      setEmployees(data);
    } catch {
      showToast(t('msg_err_emp'), 'error');
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    initMap();
    employeesApi.getAll().then(data => { setEmployees(data); setLoading(false); }).catch(() => { showToast(t('msg_err_emp'), 'error'); setLoading(false); });
  }, [initMap, t]);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setView(cityConfig.mapCenter, cityConfig.zoom);
    officeMarkerRef.current?.setLatLng(cityConfig.office);
  }, [cityConfig]);

  useEffect(() => { renderMarkers(); }, [renderMarkers]);

  const filtered = employees.filter((e) => {
    const matchSearch = e.name.toLowerCase().includes(search.toLowerCase()) || e.id.toString().includes(search);
    if (statusFilter === 'active') return matchSearch && !e.excluded;
    if (statusFilter === 'excluded') return matchSearch && e.excluded;
    return matchSearch;
  });

  const clearSelection = () => setSelected(new Set());

  const excludeSelected = async () => {
    for (const id of selected) {
      await employeesApi.update(id, { excluded: true, exclusion_reason: 'Excluded from map' });
    }
    clearSelection();
    loadEmployees();
  };

  const includeSelected = async () => {
    for (const id of selected) {
      await employeesApi.update(id, { excluded: false, exclusion_reason: '' });
    }
    clearSelection();
    loadEmployees();
  };

  const toggleExclusion = async (empId: number, currentlyExcluded: boolean) => {
    await employeesApi.update(empId, { excluded: !currentlyExcluded, exclusion_reason: currentlyExcluded ? '' : 'Excluded from table' });
    loadEmployees();
  };

  const viewOnMap = (lat: number, lon: number, empId: number) => {
    mapContainerRef.current?.scrollIntoView({ behavior: 'smooth' });
    mapRef.current?.setView([lat, lon], 13);
    setSelected(new Set([empId]));
  };

  return (
    <>
      <div className="page-title-bar">
        <div className="title-wrap">
          <h1 className="page-title">{t('emp_title')}</h1>
          <p className="page-subtitle">{t('sub_employees')}</p>
        </div>
        <div className="header-actions">
          <div className="search-box">
            <input type="text" placeholder={t('search_placeholder')} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">{t('filter_all')}</option>
            <option value="active">{t('filter_active')}</option>
            <option value="excluded">{t('filter_excluded')}</option>
          </select>
        </div>
      </div>

      <div className="page-content">
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <h2>{t('map_emp_title')}</h2>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {selected.size > 0 && (
                <>
                  <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{selected.size} selected</span>
                  <button className="btn btn-secondary btn-sm" onClick={clearSelection}>{t('btn_clear')}</button>
                  <button className="btn btn-danger btn-sm" onClick={excludeSelected}>{t('btn_exclude_sel')}</button>
                  <button className="btn btn-success btn-sm" onClick={includeSelected}>{t('btn_include_sel')}</button>
                </>
              )}
            </div>
          </div>
          <div className="card-body">
            <div ref={mapContainerRef} style={{ height: 400, borderRadius: 12, zIndex: 1 }} />
          </div>
        </div>

        <div className="table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('tbl_id')}</th>
                <th>{t('tbl_name')}</th>
                <th>{t('tbl_location')}</th>
                <th>{t('tbl_zone')}</th>
                <th>{t('tbl_cluster')}</th>
                <th>{t('tbl_status')}</th>
                <th>{t('tbl_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonLoader variant="table-row" count={8} />
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="empty">{t('msg_no_emp')}</td></tr>
              ) : (
                filtered.map((e) => (
                  <tr key={e.id} className={e.excluded ? 'excluded-row' : ''} onClick={() => viewOnMap(e.lat, e.lon, e.id)} style={{ cursor: 'pointer' }}>
                    <td>{e.id}</td>
                    <td>{e.name}</td>
                    <td>{e.lat.toFixed(4)}, {e.lon.toFixed(4)}</td>
                    <td>{e.zone_id ?? '-'}</td>
                    <td>{e.cluster_id ?? '-'}</td>
                    <td>
                      <span className={`badge ${e.excluded ? 'badge-excluded' : 'badge-active'}`}>
                        {e.excluded ? t('status_excluded') : t('status_active')}
                      </span>
                    </td>
                    <td>
                      <button
                        className={`btn-icon ${e.excluded ? 'btn-include' : 'btn-exclude'}`}
                        onClick={(ev) => { ev.stopPropagation(); toggleExclusion(e.id, e.excluded); }}
                      >
                        {e.excluded
                          ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                          : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                        }
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
