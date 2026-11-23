import { useState } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import useAsync from '../../hooks/useAsync';
import { Avatar, Badge, Button, Card, PageHeader, Table } from '../../components/common';
import UserDrawer from './UserDrawer';
import { roleLabel } from '../../utils/format';

const NO_OPTIONS = { roles: [], branches: [], managers: [] };

export default function UsersPage() {
  const { user: me } = useAuth();
  const toast = useToast();
  const { data, loading, reload } = useAsync(async () => {
    const [list, options] = await Promise.all([api.get('/users'), api.get('/users/options')]);
    return { users: list.users, options };
  }, []);
  const [editing, setEditing] = useState(null); // null: closed · 'new' · a user

  const users = data?.users || [];

  const setActive = async (u, active) => {
    try {
      await api.patch(`/users/${u._id}`, { active });
      toast.success(active ? `${u.name} can sign in again` : `${u.name} is deactivated and signed out`);
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
      header: 'User',
      render: (u) => (
        <div className="row">
          <Avatar name={u.name} size={30} />
          <div>
            <div className="cell-title">{u.name}{u._id === me.id && <span className="faint"> (you)</span>}</div>
            <div className="cell-sub">{u.email}</div>
          </div>
        </div>
      ),
    },
    { key: 'role', header: 'Role', render: (u) => <span className="capitalize">{roleLabel(u.role.name)}</span> },
    { key: 'branch', header: 'Branch', render: (u) => u.branch.name },
    { key: 'manager', header: 'Manager', render: (u) => u.manager?.name ?? <span className="faint">–</span> },
    {
      key: 'status',
      header: 'Status',
      render: (u) => (
        <div className="row">
          <Badge tone={u.active ? 'success' : 'default'} dot>{u.active ? 'active' : 'inactive'}</Badge>
          {u.readOnly && <Badge>demo</Badge>}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (u) => (
        <div className="cell-actions">
          <Button size="sm" onClick={() => setEditing(u)}>Edit</Button>
          {u._id !== me.id && !u.readOnly && (
            u.active
              ? <Button size="sm" variant="danger" onClick={() => setActive(u, false)}>Deactivate</Button>
              : <Button size="sm" onClick={() => setActive(u, true)}>Reactivate</Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Users">
        <Button variant="primary" icon="plus" onClick={() => setEditing('new')} disabled={!data}>Add user</Button>
      </PageHeader>

      <Card padded={false} className="card-fill">
        <Table columns={columns} rows={users} loading={loading && !data} empty="No users in your scope" />
      </Card>

      <UserDrawer
        open={editing !== null}
        user={editing === 'new' ? null : editing}
        self={editing?._id === me.id}
        options={data?.options || NO_OPTIONS}
        onClose={() => setEditing(null)}
        onSaved={saved}
      />
    </>
  );
}
