import { useState } from 'react';
import AppLayout from '../components/AppLayout';
import { changePassword } from '../api/auth';

export default function Account() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setError(''); setSuccess('');
    if (form.newPassword !== form.confirmPassword) { setError('New passwords do not match.'); return; }
    if (form.newPassword === form.currentPassword) { setError('Choose a different new password.'); return; }
    setSaving(true);
    try {
      const result = await changePassword(form);
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setSuccess(result.message);
    } catch (err) { setError(err.message || 'Password could not be changed. Please try again.'); }
    finally { setSaving(false); }
  }
  return <AppLayout title="My account">
    <section className="max-w-lg rounded-lg border border-ink-200 bg-white p-6">
      <h2 className="font-display text-xl mb-2">Change password</h2>
      <p className="text-sm text-ink-600 mb-5">Use at least 12 characters. Your other sessions will be signed out; this session stays signed in.</p>
      {error && <p role="alert" className="mb-4 text-brick-600">{error}</p>}
      {success && <p role="status" className="mb-4 text-green-700">{success}</p>}
      <form onSubmit={submit}>
        {Object.entries({ currentPassword: 'Current password', newPassword: 'New password', confirmPassword: 'Confirm new password' }).map(([key, label]) =>
          <label key={key} className="block mb-4 text-sm">{label}
            <input type="password" required minLength={key === 'currentPassword' ? undefined : 12} maxLength={72}
              autoComplete={key === 'currentPassword' ? 'current-password' : 'new-password'} disabled={saving}
              value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}
              className="mt-1 block w-full rounded-md border border-ink-200 px-3 py-2" />
          </label>)}
        <button disabled={saving} className="rounded-md bg-ink-900 px-4 py-2 text-white disabled:opacity-60">{saving ? 'Changing password…' : 'Change password'}</button>
      </form>
    </section>
  </AppLayout>;
}
