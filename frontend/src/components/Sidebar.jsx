import { Activity, Boxes, CircleHelp, Container, GitBranch, LayoutDashboard, LogOut, Shield, Users } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const links = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/applications', label: 'Applications', icon: Boxes },
  { to: '/builds', label: 'Build history', icon: GitBranch },
  { to: '/deployments', label: 'Deployments', icon: Container },
];

export default function Sidebar({ user, onLogout }) {
  return (
    <aside className="sidebar">
      <NavLink to="/" className="brand"><span className="brand-mark"><Activity size={19} /></span><span>deploy<span className="brand-light">ops</span></span></NavLink>
      <div className="workspace-label">WORKSPACE</div>
      <nav className="nav-links">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Icon size={17} />{label}
          </NavLink>
        ))}
        {user.role === 'admin' && <><div className="workspace-label admin-label">ADMINISTRATION</div><NavLink to="/admin" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Shield size={17} />Admin dashboard</NavLink><NavLink to="/admin/users" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Users size={17} />User management</NavLink></>}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-help"><CircleHelp size={17} /><span>Build from a safe, fixed<br />sample template.</span></div>
        <div className="profile">
          <div className="avatar">{user.name.slice(0, 1).toUpperCase()}</div>
          <div className="profile-copy"><strong>{user.name}</strong><span>{user.role === 'admin' ? 'Administrator' : 'Developer'}</span></div>
          <button className="icon-button logout-button" title="Sign out" onClick={onLogout}><LogOut size={17} /></button>
        </div>
      </div>
    </aside>
  );
}
