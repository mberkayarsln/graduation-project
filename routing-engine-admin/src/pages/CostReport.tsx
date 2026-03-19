import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { jsPDF } from 'jspdf';
import { getCostReport } from '../services/api';
import type { CostReportData } from '../services/api';

const fmt = (n: number) => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const fmtInt = (n: number) => new Intl.NumberFormat('tr-TR').format(n);

// jsPDF'in varsayilan fontlari Turkce karakterlerin tamamini desteklemedigi icin
// export metinlerini PDF-guvenli Latin karakterlere normalize ediyoruz.
const toPdfSafeText = (text: string): string => {
  const map: Record<string, string> = {
    'ı': 'i',
    'İ': 'I',
    'ğ': 'g',
    'Ğ': 'G',
    'ş': 's',
    'Ş': 'S',
    'ç': 'c',
    'Ç': 'C',
    'ö': 'o',
    'Ö': 'O',
    'ü': 'u',
    'Ü': 'U',
    'â': 'a',
    'Â': 'A',
    'î': 'i',
    'Î': 'I',
    'û': 'u',
    'Û': 'U',
    '₺': 'TL',
  };

  return text
    .replace(/[ıİğĞşŞçÇöÖüÜâÂîÎûÛ₺]/g, (ch) => map[ch] ?? ch)
    .replace(/\u00a0/g, ' ');
};

interface Params {
  driver_salary: number; sgk_rate: number; unemployment_rate: number;
  reserve_driver_ratio: number; drivers_per_vehicle: number;
  vehicle_rent: number; maintenance: number; mtv: number; insurance: number; tyre: number;
  fuel_price: number; fuel_consumption: number;
  toll_daily: number; misc_variable_per_km: number;
  working_days: number; trips_per_day: number; contract_months: number;
  overhead_rate: number; profit_rate: number; kdv_rate: number; stamp_tax_rate: number;
}

const defaultParams: Params = {
  driver_salary: 35000, sgk_rate: 22.5, unemployment_rate: 2,
  reserve_driver_ratio: 10, drivers_per_vehicle: 1,
  vehicle_rent: 25000, maintenance: 8000, mtv: 1500, insurance: 2500, tyre: 2000,
  fuel_price: 43.5, fuel_consumption: 15,
  toll_daily: 450, misc_variable_per_km: 0.75,
  working_days: 22, trips_per_day: 2, contract_months: 12,
  overhead_rate: 5, profit_rate: 10, kdv_rate: 20, stamp_tax_rate: 0.948,
};

export default function CostReportPage() {
  const { t } = useTranslation();
  const [params, setParams] = useState<Params>(defaultParams);
  const [data, setData] = useState<CostReportData | null>(null);
  const [loading, setLoading] = useState(false);

  const setParam = (key: keyof Params, val: string) => setParams((p) => ({ ...p, [key]: parseFloat(val) || 0 }));

  const calculate = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getCostReport(params as unknown as Record<string, number>);
      setData(result);
    } catch {
      alert(t('msg_calc_error'));
    } finally {
      setLoading(false);
    }
  }, [params, t]);

  useEffect(() => { calculate(); }, [calculate]);

  const exportPdf = useCallback(() => {
    if (!data) {
      alert(t('msg_calc_error'));
      return;
    }

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    let y = 16;

    const addLine = (label: string, value: string, indent = 0) => {
      doc.setFontSize(9);
      doc.text(toPdfSafeText(label), margin + indent, y);
      doc.text(toPdfSafeText(value), pageWidth - margin, y, { align: 'right' });
      y += 4.5;
    };

    const addSection = (title: string) => {
      y += 2;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(toPdfSafeText(title), margin, y);
      doc.setFont('helvetica', 'normal');
      y += 5.5;
    };

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text(toPdfSafeText(t('rpt_header')), margin, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(toPdfSafeText(`${t('rpt_date')}: ${new Date().toLocaleDateString('tr-TR')}`), margin, y);
    y += 6;

    addSection(t('card_breakdown'));
    addLine(t('lbl_st_active_emp'), fmtInt(data.system.active_employees));
    addLine(t('lbl_st_vehicles'), fmtInt(data.system.vehicle_count));
    addLine(t('lbl_st_routes'), fmtInt(data.system.route_count));
    addLine(t('lbl_st_daily_km'), fmt(data.system.daily_km));
    addLine(t('lbl_st_monthly_km'), fmt(data.system.monthly_km));
    addLine('Aylik Sefer Sayisi', fmtInt(data.system.monthly_trip_count));

    addSection(t('sect_personnel'));
    addLine('Etkin Surucu Sayisi', fmtInt(data.breakdown.driver.effective_driver_count));
    addLine(t('lbl_driver_salary'), `TL ${fmt(data.breakdown.driver.gross_salary * data.breakdown.driver.effective_driver_count)}`);
    addLine(t('lbl_sgk'), `TL ${fmt(data.breakdown.driver.sgk_per_driver * data.breakdown.driver.effective_driver_count)}`);
    addLine(t('lbl_unemployment'), `TL ${fmt(data.breakdown.driver.unemployment_per_driver * data.breakdown.driver.effective_driver_count)}`);
    addLine(t('row_personnel_total'), `TL ${fmt(data.breakdown.driver.total)}`);

    addSection(t('sect_vehicle'));
    addLine(t('lbl_vehicle_rent'), `TL ${fmt(data.breakdown.vehicle.rent_total)}`);
    addLine(t('lbl_maintenance'), `TL ${fmt(data.breakdown.vehicle.maintenance_total)}`);
    addLine(t('lbl_mtv'), `TL ${fmt(data.breakdown.vehicle.mtv_total)}`);
    addLine('Sigorta (ay/arac)', `TL ${fmt(data.breakdown.vehicle.insurance_total)}`);
    addLine('Lastik (ay/arac)', `TL ${fmt(data.breakdown.vehicle.tyre_total)}`);
    addLine(t('row_vehicle_total'), `TL ${fmt(data.breakdown.vehicle.total)}`);

    addSection(t('sect_fuel'));
    addLine(t('row_fuel_monthly'), `TL ${fmt(data.breakdown.fuel.total)}`);
    addLine('Kopru/Otoyol Gideri', `TL ${fmt(data.breakdown.toll.total)}`);
    addLine('Diger Degisken Gider', `TL ${fmt(data.breakdown.misc_variable.total)}`);
    addLine('Toplam Degisken Gider', `TL ${fmt(data.breakdown.variable_total)}`);
    
    addSection('Maliyet ve Kar Ozeti');
    addLine(t('row_subtotal'), `TL ${fmt(data.breakdown.subtotal)}`);
    addLine(t('row_net_cost'), `TL ${fmt(data.breakdown.net_cost)}`);
    addLine(t('row_pre_tax'), `TL ${fmt(data.breakdown.pre_tax_total)}`);
    addLine(t('row_grand_total'), `TL ${fmt(data.breakdown.grand_total_monthly)}`);

    addSection(t('card_contract'));
    addLine(t('row_offer_monthly'), `TL ${fmt(data.contract.monthly_total)}`);
    addLine(t('row_contract_val'), `TL ${fmt(data.contract.contract_value)}`);
    addLine(t('row_offer_total'), `TL ${fmt(data.contract.final_total)}`);
    addLine(t('row_cost_per_km'), `TL ${fmt(data.contract.per_km)}`);
    addLine('Sefer Basi Maliyet', `TL ${fmt(data.contract.per_trip)}`);

    if (data.sensitivity) {
      addSection('Duyarlilik Analizi');
      const s = data.sensitivity;
      addLine('Yakit +%10 (Delta)', `TL ${fmt(s.fuel_delta)}`);
      addLine('Sofor +%10 (Delta)', `TL ${fmt(s.salary_delta)}`);
      addLine('KM +%10 (Delta)', `TL ${fmt(s.km_delta)}`);
    }

    doc.save(`service-cost-report-${new Date().toISOString().slice(0, 10)}.pdf`);
  }, [data, t]);

  const sys = data?.system;
  const bd = data?.breakdown;
  const ct = data?.contract;
  const sn = data?.sensitivity;
  const vc = sys?.vehicle_count ?? 0;

  return (
    <>
      <div className="page-title-bar">
        <div className="title-wrap">
          <h1 className="page-title">{t('rpt_title')}</h1>
          <p className="page-subtitle">{t('sub_cost_report')}</p>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-outline" onClick={exportPdf}>{t('btn_download_pdf')}</button>
          <button className="btn btn-primary" onClick={calculate} disabled={loading}>{loading ? t('lbl_calculating') : t('btn_calculate')}</button>
        </div>
      </div>

      <div className="page-content">
        {/* Print Header */}
        <div className="print-header">
          <h1>{t('rpt_header')}</h1>
          <p className="print-date">{t('rpt_date')}: {new Date().toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>

        {/* System Stats */}
        <div className="stats-list" style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
          {[
            { label: t('lbl_st_active_emp'), value: sys ? fmtInt(sys.active_employees) : '--' },
            { label: t('lbl_st_vehicles'), value: sys ? fmtInt(sys.vehicle_count) : '--' },
            { label: t('lbl_st_routes'), value: sys ? fmtInt(sys.route_count) : '--' },
            { label: t('lbl_st_daily_km'), value: sys ? fmt(sys.daily_km) : '--' },
            { label: t('lbl_st_monthly_km'), value: sys ? fmt(sys.monthly_km) : '--' },
            { label: 'Aylik Sefer', value: sys ? fmtInt(sys.monthly_trip_count) : '--' },
          ].map((s) => (
            <div key={s.label} className="stat-item"><span className="stat-label">{s.label}</span><span className="stat-value">{s.value}</span></div>
          ))}
        </div>

        {/* Parameters */}
        <div className="card cr-params-card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <h2>{t('card_params')}</h2>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('help_params_edit')}</span>
          </div>
          <div className="card-body">
            <div className="cr-params-grid">
              <ParamGroup title={t('sect_personnel')} items={[
                { label: t('lbl_driver_salary'), key: 'driver_salary' },
                { label: t('lbl_sgk'), key: 'sgk_rate', step: 0.1 },
                { label: t('lbl_unemployment'), key: 'unemployment_rate', step: 0.1 },
                { label: 'Yedek Surucu Orani (%)', key: 'reserve_driver_ratio', step: 0.1 },
                { label: 'Arac Basina Surucu', key: 'drivers_per_vehicle', step: 0.1 },
              ]} params={params} onChange={setParam} />
              <ParamGroup title={t('sect_vehicle')} items={[
                { label: t('lbl_vehicle_rent'), key: 'vehicle_rent' },
                { label: t('lbl_maintenance'), key: 'maintenance' },
                { label: t('lbl_mtv'), key: 'mtv' },
                { label: 'Sigorta (ay/arac)', key: 'insurance' },
                { label: 'Lastik Gideri (ay/arac)', key: 'tyre' },
              ]} params={params} onChange={setParam} />
              <ParamGroup title={t('sect_fuel')} items={[
                { label: t('lbl_fuel_price'), key: 'fuel_price', step: 0.1 },
                { label: t('lbl_fuel_consumption'), key: 'fuel_consumption', step: 0.1 },
                { label: 'Kopru/Otoyol (gunluk)', key: 'toll_daily' },
                { label: 'Diger Degisken (TL/km)', key: 'misc_variable_per_km', step: 0.01 },
              ]} params={params} onChange={setParam} />
              <ParamGroup title={t('sect_operation')} items={[
                { label: t('lbl_working_days'), key: 'working_days' },
                { label: t('lbl_trips'), key: 'trips_per_day' },
                { label: t('lbl_contract_months'), key: 'contract_months' },
              ]} params={params} onChange={setParam} />
              <ParamGroup title={t('sect_tax_profit')} items={[
                { label: t('lbl_overhead'), key: 'overhead_rate', step: 0.1 },
                { label: t('lbl_profit'), key: 'profit_rate', step: 0.1 },
                { label: t('lbl_kdv'), key: 'kdv_rate', step: 0.1 },
                { label: t('lbl_stamp'), key: 'stamp_tax_rate', step: 0.001 },
              ]} params={params} onChange={setParam} />
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        {bd && ct && (
          <div className="stats-grid cr-summary-grid" style={{ marginBottom: 20 }}>
            {[
              { label: t('row_grand_total'), value: `₺${fmt(bd.grand_total_monthly)}` },
              { label: t('row_cost_per_emp'), value: `₺${fmt(ct.per_employee_monthly)}` },
              { label: t('row_cost_per_veh'), value: `₺${fmt(ct.per_vehicle_monthly)}` },
              { label: t('row_cost_per_km'), value: `₺${fmt(ct.per_km)}` },
                { label: 'Sefer Basi', value: `₺${fmt(ct.per_trip)}` },
              { label: t('row_contract_val'), value: `₺${fmt(ct.final_total)}` },
            ].map((s) => (
              <div key={s.label} className="stat-card"><span className="stat-label">{s.label}</span><span className="stat-value">{s.value}</span></div>
            ))}
          </div>
        )}

        {bd && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header"><h2>Sabit / Değişken Gider Analizi</h2></div>
            <div className="card-body">
              <div className="table-container">
                <table className="data-table cr-table">
                  <thead>
                    <tr>
                      <th>Açıklama</th>
                      <th style={{ textAlign: 'right' }}>Tutar (₺)</th>
                      <th style={{ textAlign: 'right' }}>Pay (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Sabit Giderler (Personel + Araç)</td>
                      <td style={{ textAlign: 'right' }}>₺{fmt(bd.fixed_total)}</td>
                      <td style={{ textAlign: 'right' }}>%{fmt(bd.fixed_share_pct)}</td>
                    </tr>
                    <tr>
                      <td>Değişken Giderler (Yakıt + Geçiş + Diğer)</td>
                      <td style={{ textAlign: 'right' }}>₺{fmt(bd.variable_total)}</td>
                      <td style={{ textAlign: 'right' }}>%{fmt(bd.variable_share_pct)}</td>
                    </tr>
                    <tr className="cr-subtotal-row">
                      <td><strong>Toplam Operasyonel Alt Toplam</strong></td>
                      <td style={{ textAlign: 'right' }}><strong>₺{fmt(bd.subtotal)}</strong></td>
                      <td style={{ textAlign: 'right' }}><strong>%100,00</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Breakdown Table */}
        {bd && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header"><h2>{t('card_breakdown')}</h2></div>
            <div className="card-body">
              <div className="table-container">
                <table className="data-table cr-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40%' }}>{t('tbl_item')}</th>
                      <th style={{ width: '20%' }}>{t('tbl_unit_price')}</th>
                      <th style={{ width: '15%' }}>{t('tbl_qty')}</th>
                      <th style={{ width: '25%', textAlign: 'right' }}>{t('tbl_total')} (₺)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <SectionRow label={t('sect_personnel')} />
                    <DataRow label={t('lbl_driver_salary')} unit={fmt(bd.driver.gross_salary)} qty={`${fmtInt(bd.driver.effective_driver_count)} sürücü`} total={bd.driver.gross_salary * bd.driver.effective_driver_count} />
                    <DataRow label={t('lbl_sgk')} unit={fmt(bd.driver.sgk_per_driver)} qty={`${fmtInt(bd.driver.effective_driver_count)} sürücü`} total={bd.driver.sgk_per_driver * bd.driver.effective_driver_count} />
                    <DataRow label={t('lbl_unemployment')} unit={fmt(bd.driver.unemployment_per_driver)} qty={`${fmtInt(bd.driver.effective_driver_count)} sürücü`} total={bd.driver.unemployment_per_driver * bd.driver.effective_driver_count} />
                    <DataRow label={t('row_personnel_total')} total={bd.driver.total} bold />

                    <SectionRow label={t('sect_vehicle')} />
                    <DataRow label={t('lbl_vehicle_rent')} unit={fmt(bd.vehicle.rent_per_vehicle)} qty={`${vc} araç`} total={bd.vehicle.rent_total} />
                    <DataRow label={t('lbl_maintenance')} unit={fmt(bd.vehicle.maintenance_per_vehicle)} qty={`${vc} araç`} total={bd.vehicle.maintenance_total} />
                    <DataRow label={t('lbl_mtv')} unit={fmt(bd.vehicle.mtv_per_vehicle)} qty={`${vc} araç`} total={bd.vehicle.mtv_total} />
                    <DataRow label={'Sigorta'} unit={fmt(bd.vehicle.insurance_per_vehicle)} qty={`${vc} araç`} total={bd.vehicle.insurance_total} />
                    <DataRow label={'Lastik'} unit={fmt(bd.vehicle.tyre_per_vehicle)} qty={`${vc} araç`} total={bd.vehicle.tyre_total} />
                    <DataRow label={t('row_vehicle_total')} total={bd.vehicle.total} bold />

                    <SectionRow label={t('sect_fuel')} />
                    <DataRow label={t('row_fuel_monthly')} unit={`${fmt(bd.fuel.liters_monthly)} lt`} total={bd.fuel.total} />
                    <DataRow label={'Köprü/Otoyol'} unit={`${fmt(data!.params.toll_daily)} ₺/gün`} qty={`${data!.params.working_days} gün`} total={bd.toll.total} />
                    <DataRow label={'Diğer Değişken Gider'} unit={`${fmt(bd.misc_variable.per_km)} ₺/km`} qty={`${fmt(sys!.monthly_km)} km`} total={bd.misc_variable.total} />
                    <DataRow label={'Toplam Değişken Gider'} total={bd.variable_total} bold />

                    <SectionRow label={t('sect_total_tax')} />
                    <DataRow label={t('row_subtotal')} total={bd.subtotal} bold />
                    <DataRow label={`${t('lbl_overhead')} (%${data!.params.overhead_rate})`} total={bd.overhead} />
                    <DataRow label={t('row_net_cost')} total={bd.net_cost} bold />
                    <DataRow label={`${t('lbl_profit')} (%${data!.params.profit_rate})`} total={bd.profit} />
                    <DataRow label={t('row_pre_tax')} total={bd.pre_tax_total} bold />
                    <DataRow label={`${t('lbl_kdv')} (%${data!.params.kdv_rate})`} total={bd.kdv} />
                    <HighlightRow label={t('row_grand_total')} total={bd.grand_total_monthly} />
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Contract Table */}
        {ct && (
          <div className="card">
            <div className="card-header"><h2>{t('card_contract')}</h2></div>
            <div className="card-body">
              <div className="table-container">
                <table className="data-table cr-table">
                  <thead>
                    <tr>
                      <th style={{ width: '60%' }}>Açıklama</th>
                      <th style={{ width: '40%', textAlign: 'right' }}>Tutar (₺)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td>{t('row_offer_monthly')}</td><td style={{ textAlign: 'right' }}>₺{fmt(ct.monthly_total)}</td></tr>
                    <tr><td>{t('lbl_contract_months')}</td><td style={{ textAlign: 'right' }}>{ct.months} {t('unit_months')}</td></tr>
                    <tr><td>{t('row_contract_val')}</td><td style={{ textAlign: 'right' }}>₺{fmt(ct.contract_value)}</td></tr>
                    <tr><td>{t('lbl_stamp')} (%{data!.params.stamp_tax_rate})</td><td style={{ textAlign: 'right' }}>₺{fmt(ct.stamp_tax)}</td></tr>
                    <tr className="cr-highlight-row"><td><strong>{t('row_offer_total')}</strong></td><td style={{ textAlign: 'right' }}><strong>₺{fmt(ct.final_total)}</strong></td></tr>
                    <tr><td colSpan={2} style={{ borderBottom: '2px solid var(--border-light)', padding: 4 }} /></tr>
                    <tr><td>{t('row_cost_per_emp')}</td><td style={{ textAlign: 'right' }}>₺{fmt(ct.per_employee_monthly)}</td></tr>
                    <tr><td>{t('row_cost_per_veh')}</td><td style={{ textAlign: 'right' }}>₺{fmt(ct.per_vehicle_monthly)}</td></tr>
                    <tr><td>{t('row_cost_per_km')}</td><td style={{ textAlign: 'right' }}>₺{fmt(ct.per_km)}</td></tr>
                    <tr><td>Sefer başı maliyet</td><td style={{ textAlign: 'right' }}>₺{fmt(ct.per_trip)}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {sn && (
          <div className="card" style={{ marginTop: 20 }}>
            <div className="card-header"><h2>Duyarlılık Analizi (What-if)</h2></div>
            <div className="card-body">
              <div className="table-container">
                <table className="data-table cr-table">
                  <thead>
                    <tr>
                      <th>Senaryo</th>
                      <th style={{ textAlign: 'right' }}>Aylık Toplam (₺)</th>
                      <th style={{ textAlign: 'right' }}>Baz Senaryo Farkı (₺)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Baz Senaryo</td>
                      <td style={{ textAlign: 'right' }}>₺{fmt(sn.base_monthly)}</td>
                      <td style={{ textAlign: 'right' }}>₺0,00</td>
                    </tr>
                    <tr>
                      <td>Yakıt +%10</td>
                      <td style={{ textAlign: 'right' }}>₺{fmt(sn.fuel_plus_10)}</td>
                      <td style={{ textAlign: 'right' }}>₺{fmt(sn.fuel_delta)}</td>
                    </tr>
                    <tr>
                      <td>Şoför Maliyeti +%10</td>
                      <td style={{ textAlign: 'right' }}>₺{fmt(sn.salary_plus_10)}</td>
                      <td style={{ textAlign: 'right' }}>₺{fmt(sn.salary_delta)}</td>
                    </tr>
                    <tr>
                      <td>Kilometre +%10</td>
                      <td style={{ textAlign: 'right' }}>₺{fmt(sn.km_plus_10)}</td>
                      <td style={{ textAlign: 'right' }}>₺{fmt(sn.km_delta)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/* Helper sub-components */
function ParamGroup({ title, items, params, onChange }: { title: string; items: { label: string; key: string; step?: number }[]; params: Params; onChange: (k: keyof Params, v: string) => void }) {
  return (
    <div className="cr-param-group">
      <h3 className="cr-param-title">{title}</h3>
      {items.map((it) => (
        <label key={it.key}>{it.label}<input type="number" value={params[it.key as keyof Params]} onChange={(e) => onChange(it.key as keyof Params, e.target.value)} step={it.step} /></label>
      ))}
    </div>
  );
}

function SectionRow({ label }: { label: string }) {
  return <tr><td colSpan={4} className="cr-section-row">{label}</td></tr>;
}

function DataRow({ label, unit, qty, total, bold }: { label: string; unit?: string; qty?: string; total: number; bold?: boolean }) {
  const cls = bold ? 'cr-subtotal-row' : '';
  return (
    <tr>
      <td className={cls}>{bold ? <strong>{label}</strong> : label}</td>
      <td className={cls}>{unit || ''}</td>
      <td className={cls}>{qty || ''}</td>
      <td className={cls} style={{ textAlign: 'right' }}>{bold ? <strong>₺{fmt(total)}</strong> : `₺${fmt(total)}`}</td>
    </tr>
  );
}

function HighlightRow({ label, total }: { label: string; total: number }) {
  return (
    <tr className="cr-highlight-row">
      <td colSpan={3}><strong>{label}</strong></td>
      <td style={{ textAlign: 'right' }}><strong>₺{fmt(total)}</strong></td>
    </tr>
  );
}
