import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { vehiclesApi } from '../services/api';
import type { Vehicle } from '../services/api';
import { showToast } from '../utils/toast';
import SkeletonLoader from '../components/SkeletonLoader';

export default function VehiclesPage() {
  const { t } = useTranslation();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [driverName, setDriverName] = useState('');
  const [capacity, setCapacity] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await vehiclesApi.getAll();
      setVehicles(data);
    } catch {
      showToast(t('msg_err_load_veh'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    vehiclesApi.getAll().then(data => { setVehicles(data); setLoading(false); }).catch(() => { showToast(t('msg_err_load_veh'), 'error'); setLoading(false); });
  }, [t]);

  const openAdd = () => { setEditId(null); setDriverName(''); setCapacity(''); setModalOpen(true); };

  const openEdit = (v: Vehicle) => { setEditId(v.id); setDriverName(v.driver_name || ''); setCapacity(String(v.capacity)); setModalOpen(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = { driver_name: driverName, capacity: parseInt(capacity) };
    try {
      if (editId) await vehiclesApi.update(editId, data);
      else await vehiclesApi.create(data);
      setModalOpen(false);
      load();
    } catch {
      showToast(t('msg_err_save_veh'), 'error');
    }
  };

  return (
    <>
      <div className="page-title-bar">
        <div className="title-wrap">
          <h1 className="page-title">{t('veh_title')}</h1>
          <p className="page-subtitle">{t('sub_vehicles')}</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={openAdd}>
            <i className="ti ti-plus" style={{ marginRight: 6 }} />{t('btn_add_veh')}
          </button>
        </div>
      </div>

      <div className="page-content">
        <div className="table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('tbl_id')}</th>
                <th>{t('lbl_driver_name')}</th>
                <th>{t('tbl_plate')}</th>
                <th>{t('tbl_type')}</th>
                <th>{t('lbl_capacity')}</th>
                <th>{t('tbl_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonLoader variant="table-row" count={8} />
              ) : vehicles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty">{t('msg_no_veh')}</td>
                </tr>
              ) : vehicles.map((v) => (
                <tr key={v.id} onClick={() => openEdit(v)} style={{ cursor: 'pointer' }}>
                  <td>{v.id}</td>
                  <td>{v.driver_name || <span style={{ color: 'var(--text-muted)' }}>{t('lbl_unassigned')}</span>}</td>
                  <td>{v.plate_number || '-'}</td>
                  <td>{v.vehicle_type || '-'}</td>
                  <td>{v.capacity} {t('unit_seats')}</td>
                  <td>
                    <button
                      className="btn-icon"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        openEdit(v);
                      }}
                      title={t('modal_veh_title')}
                    >
                      <i className="ti ti-pencil" style={{ fontSize: 14 }} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="modal" style={{ display: 'flex' }} onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: 420 }}>
            <div className="modal-header" style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>{editId ? `${t('modal_veh_title')} #${editId}` : t('btn_add_veh')}</h3>
              <button className="btn-icon" onClick={() => setModalOpen(false)} style={{ border: 'none', background: 'none' }}><i className="ti ti-x" /></button>
            </div>
            <div className="modal-body" style={{ padding: 24 }}>
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>{t('lbl_driver_name')}</label>
                  <input type="text" value={driverName} onChange={(e) => setDriverName(e.target.value)} placeholder={t('ph_driver')} />
                </div>
                <div className="form-group">
                  <label>{t('lbl_capacity')}</label>
                  <input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} min={1} max={50} />
                </div>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
                  <button type="button" className="btn btn-outline" onClick={() => setModalOpen(false)}>{t('btn_cancel')}</button>
                  <button type="submit" className="btn btn-primary">{t('btn_save')}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
