import './skeleton.css';

interface SkeletonProps {
  variant?: 'stat-card' | 'table-row' | 'list-item' | 'vehicle-card';
  count?: number;
}

function SkeletonStatCard() {
  return (
    <div className="stat-card skeleton-card">
      <div className="stat-info">
        <div className="skeleton skeleton-icon" />
        <div className="skeleton skeleton-text" style={{ width: '60%' }} />
      </div>
      <div className="skeleton skeleton-value" />
    </div>
  );
}

function SkeletonTableRow() {
  return (
    <tr>
      <td><div className="skeleton skeleton-text" style={{ width: 40 }} /></td>
      <td><div className="skeleton skeleton-text" style={{ width: '70%' }} /></td>
      <td><div className="skeleton skeleton-text" style={{ width: '50%' }} /></td>
      <td><div className="skeleton skeleton-text" style={{ width: 40 }} /></td>
      <td><div className="skeleton skeleton-text" style={{ width: 40 }} /></td>
      <td><div className="skeleton skeleton-badge" /></td>
      <td><div className="skeleton skeleton-text" style={{ width: 50 }} /></td>
    </tr>
  );
}

function SkeletonListItem() {
  return (
    <div className="skeleton-list-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 15px', borderBottom: '1px solid var(--border-color)' }}>
      <div className="skeleton skeleton-dot" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div className="skeleton skeleton-text" style={{ width: '60%' }} />
        <div className="skeleton skeleton-text-sm" style={{ width: '80%' }} />
      </div>
      <div className="skeleton skeleton-btn" />
    </div>
  );
}

function SkeletonVehicleCard() {
  return (
    <div className="vehicle-card skeleton-card">
      <div className="skeleton skeleton-icon-lg" style={{ margin: '0 auto 14px' }} />
      <div className="skeleton skeleton-text" style={{ width: '70%', margin: '0 auto 6px' }} />
      <div className="skeleton skeleton-text-sm" style={{ width: '50%', margin: '0 auto 14px' }} />
      <div style={{ paddingTop: 14, borderTop: '1px solid var(--border-light)' }}>
        <div className="skeleton skeleton-text-sm" style={{ width: '60%', margin: '0 auto' }} />
      </div>
    </div>
  );
}

const variants = {
  'stat-card': SkeletonStatCard,
  'table-row': SkeletonTableRow,
  'list-item': SkeletonListItem,
  'vehicle-card': SkeletonVehicleCard,
};

export default function SkeletonLoader({ variant = 'stat-card', count = 1 }: SkeletonProps) {
  const Component = variants[variant];
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <Component key={i} />
      ))}
    </>
  );
}
