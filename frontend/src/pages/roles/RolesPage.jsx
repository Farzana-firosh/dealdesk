import { useState } from 'react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import useAsync from '../../hooks/useAsync';
import { Badge, Button, Card, Table } from '../../components/common';
import { roleLabel } from '../../utils/format';
import RoleModal from './RoleModal';

const NO_CATALOG = { permissions: {}, scopes: [] };

export default function RolesPage() {
  const toast = useToast();
  const { data, loading, reload } = useAsync(async () => {
    const [list, catalog] = await Promise.all([api.get('/roles'), api.get('/roles/permissions')]);
    return { roles: list.roles, catalog };
  }, []);
  const [editing, setEditing] = useState(null); // null: closed · 'new' · a role

  const remove = async (role) => {
    if (!window.confirm(`Delete the role "${roleLabel(role.name)}"?`)) return;
    try {
      await api.delete(`/roles/${role._id}`);
      toast.success('Role deleted');
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const saved = () => {
    setEditing(null);
    reload();
  };

  const columns = [
    {
      key: 'name',
      header: 'Role',
      render: (r) => (
        <>
          <div className="cell-title capitalize">{roleLabel(r.name)}</div>
          <div className="cell-sub">{r.description || '–'}</div>
        </>
      ),
    },
    { key: 'type', header: 'Type', render: (r) => (r.builtIn ? <Badge tone="primary">built-in</Badge> : <Badge>custom</Badge>) },
    { key: 'permissions', header: 'Permissions', align: 'right', render: (r) => r.permissions.length },
    { key: 'users', header: 'Users', align: 'right', render: (r) => r.userCount },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) => (
        <div className="cell-actions">
          <Button size="sm" onClick={() => setEditing(r)}>{r.editable ? 'Edit' : 'View'}</Button>
          {r.editable && !r.builtIn && (
            <Button size="sm" variant="danger" onClick={() => remove(r)} disabled={r.userCount > 0}
              title={r.userCount > 0 ? 'Give its users another role first' : undefined}>
              Delete
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Roles</h2>
          <p>A role is a set of permissions, each with a scope. Changes apply to everyone with the role on their next request.</p>
        </div>
        <span className="spacer" />
        <Button variant="primary" icon="plus" onClick={() => setEditing('new')} disabled={!data}>New role</Button>
      </div>

      <Card padded={false}>
        <Table columns={columns} rows={data?.roles} loading={loading && !data} empty="No roles yet" />
      </Card>

      <RoleModal
        open={editing !== null}
        role={editing === 'new' ? null : editing}
        catalog={data?.catalog || NO_CATALOG}
        onClose={() => setEditing(null)}
        onSaved={saved}
      />
    </>
  );
}
