import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Avatar, Button, Drawer, Input, Select } from '../../components/common';
import { roleLabel } from '../../utils/format';

const EMPTY = { name: '', email: '', password: '', roleId: '', branchId: '', managerId: '' };

const toForm = (user) =>
  user
    ? { name: user.name, email: user.email, password: '', roleId: user.role._id, branchId: user.branch._id, managerId: user.manager?._id ?? '' }
    : EMPTY;

function validate(form, isNew) {
  const errors = {};
  if (!form.name.trim()) errors.name = 'Enter a name.';
  if (isNew && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = 'Enter a valid email address.';
  if ((isNew || form.password) && (form.password.length < 8 || form.password.length > 72)) {
    errors.password = 'Use 8 to 72 characters.';
  }
  if (!form.roleId) errors.roleId = 'Choose a role.';
  if (!form.branchId) errors.branchId = 'Choose a branch.';
  return errors;
}

// Only the fields that changed are sent, so editing your own name never touches your access.
function changesFrom(original, form) {
  const changes = {};
  if (form.name.trim() !== original.name) changes.name = form.name.trim();
  if (form.password) changes.password = form.password;
  for (const key of ['roleId', 'branchId', 'managerId']) {
    if (form[key] !== original[key]) changes[key] = form[key] || null;
  }
  return changes;
}

/** Create a user (user = null) or edit one. The API applies every rule again. */
export default function UserDrawer({ open, user, self, options, onClose, onSaved }) {
  const toast = useToast();
  const isNew = !user;
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(toForm(user));
    setErrors({});
  }, [open, user]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setBranch = (e) => setForm((f) => ({ ...f, branchId: e.target.value, managerId: '' })); // managers are per branch

  const locked = user?.readOnly;
  const accessLocked = locked || self;

  // A role you cannot assign is still shown when it is the user's current one.
  const roleOptions = options.roles
    .filter((r) => r.assignable || r._id === user?.role._id)
    .map((r) => ({ value: r._id, label: roleLabel(r.name) }));
  const branchOptions = options.branches.map((b) => ({ value: b._id, label: b.name }));
  const managerOptions = options.managers
    .filter((m) => m.branchId === form.branchId && m._id !== user?._id)
    .map((m) => ({ value: m._id, label: m.name }));

  const submit = async (e) => {
    e.preventDefault();
    const found = validate(form, isNew);
    setErrors(found);
    if (Object.keys(found).length) return;

    setBusy(true);
    try {
      if (isNew) {
        await api.post('/users', { ...form, name: form.name.trim(), email: form.email.trim(), managerId: form.managerId || null });
        toast.success('User added. Share the password with them securely.');
      } else {
        const changes = changesFrom(toForm(user), form);
        if (Object.keys(changes).length === 0) return onClose();
        await api.patch(`/users/${user._id}`, changes);
        toast.success('User updated');
      }
      onSaved();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      title={isNew ? 'Add user' : user.name}
      subtitle={isNew ? 'They sign in with this email and password.' : user.email}
      open={open}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="user-form" loading={busy} disabled={locked}>
            {isNew ? 'Add user' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form id="user-form" className="stack" onSubmit={submit} noValidate>
        {!isNew && (
          <div className="summary-box">
            <Avatar name={user.name} size={40} />
            <div>
              <b style={{ fontSize: 15 }}>{user.name}</b>
              <div className="capitalize">{roleLabel(user.role.name)} · {user.branch.name}</div>
            </div>
          </div>
        )}
        {locked && <div className="form-note">This seeded demo account is read-only. Add a new user to try editing.</div>}
        {self && !locked && <div className="form-note">You can rename yourself here. Another administrator changes your access.</div>}

        <div className="section-title">Profile</div>
        <Input label="Full name" value={form.name} onChange={set('name')} error={errors.name} disabled={locked} autoFocus />
        <Input label="Email" type="email" icon="mail" value={form.email} onChange={set('email')} error={errors.email}
          disabled={!isNew} hint={isNew ? 'Used to sign in' : 'Sign-in email cannot be changed'} autoComplete="off" />

        <div className="section-title">Access</div>
        <div className="grid-2">
          <Select label="Role" placeholder="Choose a role" value={form.roleId} onChange={set('roleId')} options={roleOptions}
            error={errors.roleId} disabled={accessLocked} />
          <Select label="Branch" placeholder="Choose a branch" value={form.branchId} onChange={setBranch} options={branchOptions}
            error={errors.branchId} disabled={accessLocked} />
        </div>
        <Select label="Manager" placeholder="No manager" value={form.managerId} onChange={set('managerId')} options={managerOptions}
          hint="Joins this user's deal chats" disabled={accessLocked || !form.branchId} />

        <div className="section-title">{isNew ? 'Password' : 'Reset password'}</div>
        <Input
          label={isNew ? 'Password' : 'New password'}
          type="password"
          icon="lock"
          value={form.password}
          onChange={set('password')}
          error={errors.password}
          hint={isNew ? 'At least 8 characters' : 'Leave blank to keep the current password'}
          autoComplete="new-password"
          disabled={accessLocked}
        />
      </form>
    </Drawer>
  );
}
