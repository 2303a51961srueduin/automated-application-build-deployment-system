export default function StatusBadge({ status }) {
  const className = (status || 'unknown').toLowerCase();
  return <span className={`status-badge status-${className}`}><span className="status-dot" />{status || 'Unknown'}</span>;
}
