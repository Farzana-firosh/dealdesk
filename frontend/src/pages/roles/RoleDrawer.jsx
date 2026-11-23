import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Button, Drawer, Icon, Input } from '../../components/common';
import { countOf, roleLabel } from '../../utils/format';
import { groupKeys, NAMES } from './permissionGroups';

const SCOPE_RANK = { own: 0, branch: 1, all: 2 };
const SCOPE_LABEL = { '': 'None', own: 'Own', branch: 'Branch', all: 'All' };

const toGrants = (permissions) => Object.fromEntries(permissions.map((p) => [p.key, p.scope]));

function ScopePicker({ permKey, value, scopes, canGive, disabled, onChange }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={NAMES[permKey] ?? permKey}>
      {scopes.map((scope) => {
        const allowed = canGive(permKey, scope);
        const selected = value === scope;
        return (
          <label key={scope} className={[selected && 'is-selected', selected && !scope && 'is-none'].filter(Boolean).join(' ') || undefined}
            title={allowed ? undefined : 'You do not have this access yourself'}>
            <input type="radio" name={permKey} value={scope} checked={selected} onChange={() => onChange(scope)} disabled={disabled || !allowed} />
            {SCOPE_LABEL[scope]}
          </label>
        );
      })}
    </div>
  );
}

/** Create a role (role = null) or edit one. Scopes the caller does not hold are disabled; the API checks again. */
export default function RoleDrawer({ open, role, catalog, onClose, onSaved, onDelete }) {
  const { user } = useAuth();
  const toast = useToast();
  const isNew = !role;
  const readOnly = Boolean(role && !role.editable);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [grants, setGrants] = useState({}); // key -> scope
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(role?.name ?? '');
    setDescription(role?.description ?? '');
    setGrants(toGrants(role?.permissions ?? []));
    setError('');
  }, [open, role]);

  const held = toGrants(user.role.permissions);
  const canGive = (key, scope) => scope === '' || (held[key] && SCOPE_RANK[held[key]] >= SCOPE_RANK[scope]);
  const choose = (key, scope) => setGrants((g) => ({ ...g, [key]: scope }));
  const granted = Object.values(grants).filter(Boolean).length;

  const submit = async (e) => {
    e.preventDefault();
    const cleanName = name.trim().toLowerCase();
    if (isNew && !/^[a-z][a-z0-9_]*$/.test(cleanName)) {
      setError('Use lowercase letters, numbers and _, starting with a letter (e.g. regional_auditor).');
      return;
    }
    setError('');
    const permissions = Object.entries(grants).filter(([, scope]) => scope).map(([key, scope]) => ({ key, scope }));

    setBusy(true);
    try {
      if (isNew) await api.post('/roles', { name: cleanName, description: description.trim(), permissions });
      else await api.patch(`/roles/${role._id}`, { description: description.trim(), permissions });
      toast.success(isNew ? 'Role created' : 'Role saved – it applies to its users immediately');
      onSaved();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const scopes = ['', ...catalog.scopes];
  const groups = groupKeys(Object.keys(catalog.permissions));
  const canDelete = role && role.editable && !role.builtIn;

  return (
    <Drawer
      title={isNew ? 'New role' : roleLabel(role.name)}
      subtitle={isNew ? 'Pick what this role can do, and how widely.' : role.description}
      open={open}
      onClose={onClose}
      size="lg"
      footer={
        <>
          {canDelete && (
            <Button variant="danger" icon="x" onClick={() => onDelete(role)} disabled={role.userCount > 0}
              title={role.userCount > 0 ? 'Give its users another role first' : undefined}>
              Delete role
            </Button>
          )}
          <span className="spacer" />
          <Button onClick={onClose}>{readOnly ? 'Close' : 'Cancel'}</Button>
          {!readOnly && <Button variant="primary" type="submit" form="role-form" loading={busy}>{isNew ? 'Create role' : 'Save role'}</Button>}
        </>
      }
    >
      <form id="role-form" className="stack" onSubmit={submit} noValidate>
        {readOnly && (
          <div className="form-note">
            <Icon name="lock" size={15} />
            {role._id === user.role._id ? 'This is your own role. Another administrator can change it.' : 'You can view this role but not change it.'}
          </div>
        )}

        <div className="grid-2">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} error={error} disabled={!isNew}
            placeholder="regional_auditor" hint={isNew ? 'Used in the approval rules; fixed once created' : 'Fixed once created'} autoFocus={isNew} />
          <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} disabled={readOnly}
            placeholder="What this role is for" />
        </div>

        <div className="summary-box">
          <b>{granted}</b>
          <span>of {countOf(Object.keys(catalog.permissions).length, 'permission')} granted</span>
          <span className="spacer" />
          <span className="faint">Own · Branch · All. You can only give access you hold yourself.</span>
        </div>

        {groups.map((g) => (
          <section key={g.id} className="perm-group" aria-label={g.label}>
            <div className="perm-group-head">
              <Icon name={g.icon} size={16} />
              <b>{g.label}</b>
              <span className="faint">{g.keys.filter((k) => grants[k]).length}/{g.keys.length}</span>
            </div>
            {g.keys.map((key) => (
              <div key={key} className="perm-row">
                <div>
                  <div className="perm-name">{NAMES[key] ?? key}</div>
                  {catalog.permissions[key] !== NAMES[key] && <div className="cell-sub">{catalog.permissions[key]}</div>}
                  <code>{key}</code>
                </div>
                <ScopePicker permKey={key} value={grants[key] ?? ''} scopes={scopes} canGive={canGive} disabled={readOnly}
                  onChange={(scope) => choose(key, scope)} />
              </div>
            ))}
          </section>
        ))}
      </form>
    </Drawer>
  );
}
