import { useState } from 'react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import useAsync from '../../hooks/useAsync';
import { Badge, Button, Card, EmptyState, Icon, PageHeader } from '../../components/common';
import { countOf, roleLabel } from '../../utils/format';
import { GROUPS } from './permissionGroups';
import RoleDrawer from './RoleDrawer';

const NO_CATALOG = { permissions: {}, scopes: [] };

// "sales_manager" -> "SM", "admin" -> "AD"
const monogram = (name) => {
  const parts = name.split('_').filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase();
};

function RoleCard({ role, onOpen }) {
  const held = new Set(role.permissions.map((p) => p.key));
  return (
    <button type="button" className="card role-card" onClick={onOpen}>
      <div className="role-card-head">
        <span className={`role-icon${role.builtIn ? '' : ' is-custom'}`}>{monogram(role.name)}</span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3>{roleLabel(role.name)}</h3>
          <div className="row" style={{ marginTop: 4 }}>
            {role.builtIn ? <Badge tone="primary">built-in</Badge> : <Badge tone="info">custom</Badge>}
            {!role.editable && <Badge><Icon name="lock" size={11} /> read-only</Badge>}
          </div>
        </div>
      </div>
      <p>{role.description || 'No description'}</p>
      <div className="area-chips" aria-label="Areas this role can use">
        {GROUPS.map((g) => (
          <span key={g.id} className={`area-chip${g.keys.some((k) => held.has(k)) ? ' on' : ''}`}>{g.label}</span>
        ))}
      </div>
      <div className="role-meta">
        <span><Icon name="users" size={14} />{countOf(role.userCount, 'user')}</span>
        <span><Icon name="layers" size={14} />{countOf(role.permissions.length, 'permission')}</span>
        <span className="spacer" />
        <span style={{ color: 'var(--primary)', fontWeight: 500 }}>{role.editable ? 'Edit' : 'View'} <Icon name="arrowRight" size={13} /></span>
      </div>
    </button>
  );
}

export default function RolesPage() {
  const toast = useToast();
  const { data, loading, reload } = useAsync(async () => {
    const [list, catalog] = await Promise.all([api.get('/roles'), api.get('/roles/permissions')]);
    return { roles: list.roles, catalog };
  }, []);
  const [editing, setEditing] = useState(null); // null: closed · 'new' · a role

  const remove = async (role) => {
    if (!window.confirm(`Delete the role "${roleLabel(role.name)}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/roles/${role._id}`);
      toast.success('Role deleted');
      setEditing(null);
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const saved = () => {
    setEditing(null);
    reload();
  };

  return (
    <>
      <PageHeader title="Roles">
        <Button variant="primary" icon="plus" onClick={() => setEditing('new')} disabled={!data}>New role</Button>
      </PageHeader>

      {loading && !data ? (
        <Card><div className="empty">Loading…</div></Card>
      ) : data?.roles.length ? (
        <div className="role-grid">
          {data.roles.map((r) => <RoleCard key={r._id} role={r} onOpen={() => setEditing(r)} />)}
        </div>
      ) : (
        <Card><EmptyState icon="shield" title="No roles yet" /></Card>
      )}

      <RoleDrawer
        open={editing !== null}
        role={editing === 'new' ? null : editing}
        catalog={data?.catalog || NO_CATALOG}
        onClose={() => setEditing(null)}
        onSaved={saved}
        onDelete={remove}
      />
    </>
  );
}
