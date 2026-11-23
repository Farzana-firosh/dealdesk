import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Button, Input, Modal } from '../../components/common';
import { roleLabel } from '../../utils/format';

const SCOPE_RANK = { own: 0, branch: 1, all: 2 };
const SCOPE_LABEL = { '': 'None', own: 'Own', branch: 'Branch', all: 'All' };

const toGrants = (permissions) => Object.fromEntries(permissions.map((p) => [p.key, p.scope]));

/** Create a role (role = null) or edit one. Scopes the caller does not hold are disabled; the API checks again. */
export default function RoleModal({ open, role, catalog, onClose, onSaved }) {
  const { user } = useAuth();
  const toast = useToast();
  const isNew = !role;
  const readOnly = role && !role.editable;
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

  const keys = Object.keys(catalog.permissions);
  const scopes = ['', ...catalog.scopes];

  return (
    <Modal
      title={isNew ? 'New role' : `Role · ${roleLabel(role.name)}`}
      open={open}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>{readOnly ? 'Close' : 'Cancel'}</Button>
          {!readOnly && <Button variant="primary" type="submit" form="role-form" loading={busy}>{isNew ? 'Create role' : 'Save role'}</Button>}
        </>
      }
    >
      <form id="role-form" className="stack" onSubmit={submit} noValidate>
        {readOnly && <div className="form-note">{role.name === user.role.name ? 'This is your own role. Another administrator can change it.' : 'You cannot change this role.'}</div>}

        <div className="grid-2">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} error={error} disabled={!isNew}
            placeholder="regional_auditor" hint={isNew ? 'Used in the approval rules; cannot be changed later' : undefined} autoFocus={isNew} />
          <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} disabled={readOnly}
            placeholder="What this role is for" />
        </div>

        <div className="perm-grid" role="group" aria-label="Permissions">
          <p className="faint">Own: records they own · Branch: their branch · All: every branch. You can only give access you have yourself.</p>
          {keys.map((key) => (
            <div key={key} className="perm-row">
              <div>
                <b className="mono">{key}</b>
                <div className="cell-sub">{catalog.permissions[key]}</div>
              </div>
              <div className="segmented" role="radiogroup" aria-label={key}>
                {scopes.map((scope) => {
                  const allowed = canGive(key, scope);
                  return (
                    <label key={scope} className={(grants[key] ?? '') === scope ? 'is-selected' : undefined}
                      title={allowed ? undefined : 'You do not have this access yourself'}>
                      <input type="radio" name={key} value={scope} checked={(grants[key] ?? '') === scope}
                        onChange={() => choose(key, scope)} disabled={readOnly || !allowed} />
                      {SCOPE_LABEL[scope]}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </form>
    </Modal>
  );
}
