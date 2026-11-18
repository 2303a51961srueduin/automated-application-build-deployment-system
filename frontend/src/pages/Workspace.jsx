import { useCallback, useEffect, useState } from 'react';
import { Activity, ArrowDownToLine, ArrowRight, Boxes, Check, ChevronRight, CircleAlert, Clock3, Container, GitBranch, Plus, RefreshCw, Rocket, ShieldCheck, Users, X } from 'lucide-react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { api, formatDate } from '../api.js';
import Sidebar from '../components/Sidebar.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import Modal from '../components/Modal.jsx';

function useWorkspaceData() {
  const [data, setData] = useState({ applications: [], builds: [], deployments: [] });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try {
      const [applications, builds, deployments] = await Promise.all([
        api('/applications'), api('/builds'), api('/deployments'),
      ]);
      setData({ applications: applications.applications, builds: builds.builds, deployments: deployments.deployments });
      setError('');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);
  return { ...data, error, loading, refresh };
}

function PageHeader({ title, subtitle, action }) {
  return <div className="page-heading"><div><div className="breadcrumb">WORKSPACE <ChevronRight size={13} /> {title.toUpperCase()}</div><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>;
}

function MetricCard({ title, value, detail, icon: Icon, tone = 'blue' }) {
  return <article className="metric-card"><div className={`metric-icon ${tone}`}><Icon size={18} /></div><div className="metric-copy"><span>{title}</span><strong>{value}</strong><small>{detail}</small></div></article>;
}

function EmptyState({ icon: Icon, title, description, action }) {
  return <div className="empty-state"><div className="empty-icon"><Icon size={22} /></div><h3>{title}</h3><p>{description}</p>{action}</div>;
}

function Applications({ data, notify }) {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', template: 'sample-web' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function createApplication(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/applications', { method: 'POST', body: JSON.stringify(form) });
      setShowModal(false);
      setForm({ name: '', description: '', template: 'sample-web' });
      notify('Application created.');
      await data.refresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }
  async function startBuild(application) {
    try {
      await api(`/applications/${application.id}/builds`, { method: 'POST' });
      notify(`Build queued for ${application.name}.`);
      await data.refresh();
    } catch (error) {
      notify(error.message, 'error');
    }
  }
  async function deploy(application) {
    try {
      await api(`/applications/${application.id}/deployments`, { method: 'POST' });
      notify(`Deployment queued for ${application.name}.`);
      await data.refresh();
    } catch (error) {
      notify(error.message, 'error');
    }
  }
  return (
    <>
      <PageHeader title="Applications" subtitle="Manage your applications and start a verified build." action={<button className="button primary" onClick={() => setShowModal(true)}><Plus size={17} /> New application</button>} />
      <section className="application-grid">
        {data.applications.map((application) => (
          <article className="application-card" key={application.id}>
            <div className="application-card-top"><div className="app-icon"><Boxes size={20} /></div><StatusBadge status={application.latest_build_status || 'Not built'} /></div>
            <h3>{application.name}</h3><p>{application.description || 'Sample application using the managed static-web template.'}</p>
            <div className="app-meta"><span><GitBranch size={14} /> sample-web</span><span><Clock3 size={14} /> {application.build_count} builds</span></div>
            <div className="card-actions"><button className="button secondary" onClick={() => startBuild(application)}><GitBranch size={15} /> Build</button><button className="button primary" disabled={application.latest_build_status !== 'Success'} title={application.latest_build_status !== 'Success' ? 'Run a successful build before deploying' : 'Deploy the latest successful build'} onClick={() => deploy(application)}><Rocket size={15} /> Deploy</button></div>
          </article>
        ))}
        {data.applications.length === 0 && <div className="full-width"><EmptyState icon={Boxes} title="No applications yet" description="Create an application to run your first real build." action={<button className="button primary" onClick={() => setShowModal(true)}><Plus size={16} /> Create application</button>} /></div>}
      </section>
      {showModal && <Modal title="Create application" onClose={() => setShowModal(false)}><form className="form-stack modal-form" onSubmit={createApplication}><label>Application name<input required minLength="2" maxLength="80" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Customer portal" /></label><label>Description <span className="optional">OPTIONAL</span><textarea rows="3" maxLength="500" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="What does this application do?" /></label><label>Build template<input value="Sample web application" disabled /><small className="field-note">The managed template uses a fixed, reviewed build script. Custom server commands are not accepted.</small></label>{error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="button secondary" onClick={() => setShowModal(false)}>Cancel</button><button className="button primary" disabled={busy}>{busy ? 'Creating…' : 'Create application'}</button></div></form></Modal>}
    </>
  );
}

function LogsModal({ build, onClose }) {
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => { api(`/builds/${build.id}/logs`).then(({ logs: records }) => setLogs(records)).catch((reason) => setError(reason.message)); }, [build.id]);
  return <Modal title={`Build #${build.id} logs`} onClose={onClose}><div className="log-meta"><StatusBadge status={build.status} /><span>{build.application_name}</span><span>{formatDate(build.created_at)}</span></div>{error ? <div className="form-error">{error}</div> : <div className="log-view">{logs.map((line) => <div key={line.id} className={`log-line log-${line.stream}`}><time>{formatDate(line.created_at)}</time><span className="log-stream">{line.stream}</span><code>{line.message}</code></div>)}{logs.length === 0 && <p className="muted">No output recorded yet. Refresh once the build starts.</p>}</div>}</Modal>;
}

function DataTable({ headers, children, empty }) {
  return <div className="table-wrap"><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{children}</tbody>{empty}</table></div>;
}

function Builds({ data }) {
  const [selected, setSelected] = useState(null);
  return <><PageHeader title="Build history" subtitle="Every build request, result, and captured output." /><section className="panel"><div className="panel-heading"><div><h2>All builds</h2><p>{data.builds.length} records</p></div><button className="icon-button" onClick={data.refresh} aria-label="Refresh"><RefreshCw size={17} /></button></div><DataTable headers={['BUILD', 'APPLICATION', 'STATUS', 'REQUESTED BY', 'CREATED', 'LOGS']} empty={data.builds.length === 0 ? <caption className="table-empty">Your build activity will appear here after you start a build.</caption> : null}>{data.builds.map((build) => <tr key={build.id}><td className="mono">#{build.id}</td><td className="strong-cell">{build.application_name}</td><td><StatusBadge status={build.status} /></td><td>{build.requested_by_name}</td><td>{formatDate(build.created_at)}</td><td><button className="text-button" onClick={() => setSelected(build)}><ArrowDownToLine size={14} /> View logs</button></td></tr>)}</DataTable></section>{selected && <LogsModal build={selected} onClose={() => setSelected(null)} />}</>;
}

function Deployments({ data, notify }) {
  async function stopDeployment(deployment) {
    try {
      await api(`/deployments/${deployment.id}/stop`, { method: 'POST' });
      notify('Container stop requested.');
      await data.refresh();
    } catch (error) {
      notify(error.message, 'error');
    }
  }
  return <>  <PageHeader title="Deployments" subtitle="Monitor managed containers created from successful builds." /><section className="panel"><div className="panel-heading"><div><h2>Deployment history</h2><p>{data.deployments.length} records</p></div><button className="icon-button" onClick={data.refresh} aria-label="Refresh"><RefreshCw size={17} /></button></div><DataTable headers={['DEPLOYMENT', 'APPLICATION', 'STATUS', 'CONTAINER', 'URL', 'CREATED']} empty={data.deployments.length === 0 ? <caption className="table-empty">A successful build is needed before a deployment can be started.</caption> : null}>{data.deployments.map((deployment) => <tr key={deployment.id}><td className="mono">#{deployment.id}</td><td className="strong-cell">{deployment.application_name}</td><td><StatusBadge status={deployment.status} /></td><td className="mono small-mono">{deployment.container_name}</td><td>{deployment.url ? <a className="text-link" href={deployment.url} target="_blank" rel="noreferrer">Open app <ArrowRight size={13} /></a> : '—'}</td><td>{formatDate(deployment.created_at)}{deployment.status === 'Success' && <button className="text-button stop-action" onClick={() => stopDeployment(deployment)}><X size={14} /> Stop</button>}</td></tr>)}</DataTable></section></>;
}

function Overview({ user, data, notify }) {
  const successful = data.builds.filter((build) => build.status === 'Success').length;
  const failed = data.builds.filter((build) => build.status === 'Failed').length;
  const running = data.builds.filter((build) => ['Pending', 'Running'].includes(build.status)).length;
  return <>
    <PageHeader title={`Good ${new Date().getHours() < 12 ? 'morning' : 'afternoon'}, ${user.name.split(' ')[0]}`} subtitle="Here's what's happening across your applications." action={<Link className="button primary" to="/applications"><Plus size={17} /> New application</Link>} />
    <section className="metric-grid"><MetricCard title="Applications" value={data.applications.length} detail="In your workspace" icon={Boxes} /><MetricCard title="Total builds" value={data.builds.length} detail="All time" icon={GitBranch} tone="violet" /><MetricCard title="Successful builds" value={successful} detail="Ready to deploy" icon={Check} tone="green" /><MetricCard title="Active builds" value={running} detail={failed ? `${failed} failed` : 'No failures'} icon={Activity} tone={failed ? 'red' : 'amber'} /></section>
    <section className="content-grid"><div className="panel"><div className="panel-heading"><div><h2>Recent builds</h2><p>Latest activity from your applications</p></div><Link className="panel-link" to="/builds">View all <ArrowRight size={14} /></Link></div>{data.builds.length ? <div className="activity-list">{data.builds.slice(0, 5).map((build) => <div className="activity-row" key={build.id}><div className={`activity-icon ${build.status === 'Success' ? 'good' : build.status === 'Failed' ? 'bad' : 'waiting'}`}><GitBranch size={16} /></div><div className="activity-copy"><strong>{build.application_name}</strong><span>Build #{build.id} · {formatDate(build.created_at)}</span></div><StatusBadge status={build.status} /></div>)}</div> : <EmptyState icon={GitBranch} title="No builds yet" description="Create an application and start a build to see your activity." action={<Link className="button secondary" to="/applications">View applications</Link>} />}</div>
      <div className="panel quick-panel"><div className="panel-heading"><div><h2>Quick start</h2><p>Move from code to a running app</p></div></div><div className="quick-steps"><div className="quick-step"><span>01</span><div><strong>Create an application</strong><small>Choose the managed sample template.</small></div><Boxes size={17} /></div><div className="quick-step"><span>02</span><div><strong>Run a build</strong><small>Execute the real build script.</small></div><GitBranch size={17} /></div><div className="quick-step"><span>03</span><div><strong>Deploy a container</strong><small>Start the image with Docker.</small></div><Container size={17} /></div></div><Link className="button secondary wide" to="/applications">Go to applications <ArrowRight size={16} /></Link></div>
    </section>
    {user.role === 'admin' && <AdminOverview notify={notify} />}
  </>;
}

function AdminOverview() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api('/admin/stats').then(({ stats: result }) => setStats(result)).catch((reason) => setError(reason.message)); }, []);
  if (error) return <div className="form-error">{error}</div>;
  if (!stats) return <section className="panel admin-summary"><span className="spinner" /> Loading admin statistics…</section>;
  return <section className="panel admin-summary"><div className="panel-heading"><div><h2><ShieldCheck size={18} /> Platform overview</h2><p>System-wide delivery metrics</p></div><Link className="panel-link" to="/admin">Admin dashboard <ArrowRight size={14} /></Link></div><div className="admin-metrics"><span><Users size={15} /> {stats.users} users</span><span><Boxes size={15} /> {stats.applications} applications</span><span><Check size={15} /> {stats.successfulBuilds} successful builds</span><span><Container size={15} /> {stats.successfulDeployments} live deployments</span></div></section>;
}

function Admin({ user }) {
  const [stats, setStats] = useState(null);
  const [builds, setBuilds] = useState([]);
  const [activities, setActivities] = useState([]);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      const [metrics, buildRows, activityRows] = await Promise.all([api('/admin/stats'), api('/builds'), api('/admin/activity')]);
      setStats(metrics.stats);
      setBuilds(buildRows.builds);
      setActivities(activityRows.activities);
    } catch (reason) { setError(reason.message); }
  }, []);
  useEffect(() => { load(); }, [load]);
  if (error) return <><PageHeader title="Admin dashboard" subtitle="Platform-wide delivery and user monitoring." /><div className="form-error">{error}</div></>;
  if (!stats) return <div className="screen-loading"><span className="spinner" /> Loading administration…</div>;
  return <><PageHeader title="Admin dashboard" subtitle={`Platform-wide view for ${user.name}.`} action={<Link className="button secondary" to="/admin/users"><Users size={16} /> Manage users</Link>} />
    <section className="metric-grid admin-metric-grid"><MetricCard title="Registered users" value={stats.users} detail="Active and inactive accounts" icon={Users} /><MetricCard title="Applications" value={stats.applications} detail="Across all users" icon={Boxes} tone="violet" /><MetricCard title="Total builds" value={stats.builds} detail={`${stats.successfulBuilds} succeeded`} icon={GitBranch} tone="green" /><MetricCard title="Failed builds" value={stats.failedBuilds} detail={`${stats.deployments} deployments total`} icon={CircleAlert} tone="red" /></section>
    <section className="panel"><div className="panel-heading"><div><h2>All build activity</h2><p>Most recent 200 build records</p></div><button className="icon-button" onClick={load} aria-label="Refresh"><RefreshCw size={17} /></button></div><DataTable headers={['BUILD', 'APPLICATION', 'REQUESTED BY', 'STATUS', 'CREATED']} empty={builds.length === 0 ? <caption className="table-empty">No build records have been created.</caption> : null}>{builds.slice(0, 20).map((build) => <tr key={build.id}><td className="mono">#{build.id}</td><td className="strong-cell">{build.application_name}</td><td>{build.requested_by_name}</td><td><StatusBadge status={build.status} /></td><td>{formatDate(build.created_at)}</td></tr>)}</DataTable></section>
    <section className="panel activity-panel"><div className="panel-heading"><div><h2>Recent platform activity</h2><p>Audited events from users and delivery tasks</p></div></div><div className="audit-list">{activities.slice(0, 8).map((event) => <div className="audit-row" key={event.id}><Activity size={15} /><span><strong>{event.user_name || 'System'}</strong> {event.action.replaceAll('.', ' ')}</span><time>{formatDate(event.created_at)}</time></div>)}</div></section>
  </>;
}

function UsersAdmin() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const load = useCallback(() => api('/admin/users').then(({ users: rows }) => setUsers(rows)).catch((reason) => setError(reason.message)), []);
  useEffect(() => { load(); }, [load]);
  async function update(user, field, value) {
    setError('');
    setSuccess('');
    try {
      await api(`/admin/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ role: field === 'role' ? value : user.role, active: field === 'active' ? value : Boolean(user.active) }),
      });
      setSuccess(`${user.name}'s account was updated.`);
      await load();
    } catch (reason) { setError(reason.message); }
  }
  return <><PageHeader title="User management" subtitle="Review accounts and control access roles." /><section className="panel"><div className="panel-heading"><div><h2>Registered users</h2><p>{users.length} accounts</p></div><button className="icon-button" onClick={load} aria-label="Refresh"><RefreshCw size={17} /></button></div>{error && <div className="form-error inline-message">{error}</div>}{success && <div className="form-success inline-message">{success}</div>}<DataTable headers={['USER', 'EMAIL', 'ROLE', 'APPLICATIONS', 'STATUS', 'JOINED']} empty={users.length === 0 ? <caption className="table-empty">No user accounts found.</caption> : null}>{users.map((account) => <tr key={account.id}><td className="strong-cell">{account.name}</td><td>{account.email}</td><td><select className="table-select" value={account.role} onChange={(event) => update(account, 'role', event.target.value)}><option value="user">User</option><option value="admin">Admin</option></select></td><td>{account.application_count}</td><td><button className={`toggle-status ${account.active ? 'enabled' : ''}`} onClick={() => update(account, 'active', !account.active)}>{account.active ? 'Active' : 'Disabled'}</button></td><td>{formatDate(account.created_at)}</td></tr>)}</DataTable></section></>;
}

export default function Workspace({ user, onLogout }) {
  const data = useWorkspaceData();
  const [toast, setToast] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => { if (toast) { const timer = window.setTimeout(() => setToast(null), 4200); return () => window.clearTimeout(timer); } }, [toast]);
  useEffect(() => { if (location.pathname.startsWith('/admin') && user.role !== 'admin') navigate('/', { replace: true }); }, [location.pathname, navigate, user.role]);
  function notify(message, type = 'success') { setToast({ message, type }); }

  return <div className="app-shell"><Sidebar user={user} onLogout={onLogout} /><main className="main-content"><div className="mobile-topbar"><Link to="/" className="brand"><span className="brand-mark"><Activity size={18} /></span><span>deploy<span className="brand-light">ops</span></span></Link><button className="button secondary mobile-logout" onClick={onLogout}>Sign out</button></div>
    {data.error && <div className="global-error"><CircleAlert size={16} /> {data.error} <button className="icon-button" onClick={data.refresh} aria-label="Retry"><RefreshCw size={14} /></button></div>}
    {data.loading ? <div className="screen-loading content-loading"><span className="spinner" /> Loading your workspace…</div> : <Routes><Route path="/" element={<Overview user={user} data={data} notify={notify} />} /><Route path="/applications" element={<Applications data={data} notify={notify} />} /><Route path="/builds" element={<Builds data={data} />} /><Route path="/deployments" element={<Deployments data={data} notify={notify} />} />{user.role === 'admin' && <><Route path="/admin" element={<Admin user={user} />} /><Route path="/admin/users" element={<UsersAdmin />} /></>}<Route path="*" element={<Navigate to="/" replace />} /></Routes>}
  </main>{toast && <div role="status" className={`toast ${toast.type === 'error' ? 'toast-error' : ''}`}>{toast.type === 'error' ? <CircleAlert size={17} /> : <Check size={17} />}{toast.message}<button className="icon-button" onClick={() => setToast(null)} aria-label="Dismiss"><X size={15} /></button></div>}</div>;
}
