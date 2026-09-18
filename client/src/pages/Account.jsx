import { useState } from 'react';
import AppLayout from '../components/AppLayout';
import { changePassword } from '../api/auth';
import Button from '../components/Button';
import { Field, PasswordInput, TextArea, TextInput } from '../components/FormFields';
import * as backupsApi from '../api/backups';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_ACADEMY_SETTINGS, useAcademy } from '../context/academy';

export default function Account() {
  const { isAdmin } = useAuth();
  const academy = useAcademy();
  return <AppLayout title="My account">
    <div className="grid max-w-5xl gap-6 lg:grid-cols-2">
      {isAdmin && <AcademySettings key={academy.settings.updatedAt || academy.settings.academyName} academy={academy} />}
      <PasswordSettings />
      {isAdmin && <BackupSettings />}
    </div>
  </AppLayout>;
}

function PasswordSettings() {
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
  return <section className="rounded-lg border border-ink-200 bg-white p-6">
      <h2 className="font-display text-xl mb-2">Change password</h2>
      <p className="text-sm text-ink-600 mb-5">Use at least 12 characters. Your other sessions will be signed out; this session stays signed in.</p>
      {error && <p role="alert" className="mb-4 text-brick-600">{error}</p>}
      {success && <p role="status" className="mb-4 text-green-700">{success}</p>}
      <form onSubmit={submit}>
        {Object.entries({ currentPassword: 'Current password', newPassword: 'New password', confirmPassword: 'Confirm new password' }).map(([key, label]) =>
          <label key={key} className="block mb-4 text-sm">{label}
            <PasswordInput required minLength={key === 'currentPassword' ? undefined : 12} maxLength={72}
              autoComplete={key === 'currentPassword' ? 'current-password' : 'new-password'} disabled={saving}
              value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}
              className="mt-1" />
          </label>)}
        <button disabled={saving} className="rounded-md bg-ink-900 px-4 py-2 text-white disabled:opacity-60">{saving ? 'Changing password…' : 'Change password'}</button>
      </form>
  </section>;
}

function AcademySettings({ academy: { settings, saveSettings } }) {
  const [form, setForm] = useState({ ...DEFAULT_ACADEMY_SETTINGS, ...settings });
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const update = (key) => (event) => setForm((value) => ({ ...value, [key]: event.target.value }));

  async function submit(event) {
    event.preventDefault(); setMessage(''); setSaving(true);
    try { await saveSettings(form); setMessage('Academy and receipt details saved.'); }
    catch (error) { setMessage(error.message || 'Settings could not be saved.'); }
    finally { setSaving(false); }
  }

  return <section className="rounded-lg border border-ink-200 bg-white p-6">
    <h2 className="mb-2 font-display text-xl">Academy & receipt details</h2>
    <p className="mb-5 text-sm text-ink-600">These details appear in the app and on printed payment receipts.</p>
    {message && <p role="status" className="mb-4 text-sm text-moss-600">{message}</p>}
    <form onSubmit={submit}>
      <Field label="Academy name" required><TextInput required maxLength={120} value={form.academyName} onChange={update('academyName')} /></Field>
      <Field label="Academy phone"><TextInput maxLength={40} value={form.academyPhone} onChange={update('academyPhone')} /></Field>
      <Field label="Name shown on receipts"><TextInput maxLength={120} placeholder="Uses academy name when blank" value={form.receiptName} onChange={update('receiptName')} /></Field>
      <Field label="Phone shown on receipts"><TextInput maxLength={40} placeholder="Uses academy phone when blank" value={form.receiptPhone} onChange={update('receiptPhone')} /></Field>
      <Field label="Receipt footer"><TextArea maxLength={500} value={form.receiptFooter} onChange={update('receiptFooter')} /></Field>
      <Button disabled={saving}>{saving ? 'Saving…' : 'Save details'}</Button>
    </form>
  </section>;
}

function BackupSettings() {
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState(null);
  const [details, setDetails] = useState(null);
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');

  async function create() {
    setBusy(true); setMessage('');
    try {
      const { blob, fileName } = await backupsApi.createBackup();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = fileName; link.click(); URL.revokeObjectURL(url);
      setMessage(`Backup created: ${fileName}. A second copy is stored in the project's local-backups folder.`);
    } catch (error) { setMessage(error.message || 'Backup could not be created.'); }
    finally { setBusy(false); }
  }

  async function choose(event) {
    const selected = event.target.files?.[0] || null;
    setFile(selected); setDetails(null); setConfirmation(''); setMessage('');
    if (!selected) return;
    setBusy(true);
    try { setDetails(await backupsApi.inspectBackup(selected)); }
    catch (error) { setFile(null); setMessage(error.message || 'That backup could not be read.'); }
    finally { setBusy(false); }
  }

  async function restore() {
    if (!file || confirmation !== 'RESTORE') return;
    setBusy(true); setMessage('');
    try {
      const result = await backupsApi.restoreBackup(file);
      setMessage(`${result.message} A safety copy was saved as ${result.safetyBackup}.`);
      setFile(null); setDetails(null); setConfirmation('');
    } catch (error) { setMessage(error.message || 'Restore failed.'); }
    finally { setBusy(false); }
  }

  return <section className="rounded-lg border border-ink-200 bg-white p-6 lg:col-span-2">
    <h2 className="mb-2 font-display text-xl">Database backup & restore</h2>
    <p className="mb-4 text-sm text-ink-600">Create a backup after important changes and copy the downloaded file to a USB drive or another safe device.</p>
    {message && <p role="status" className="mb-4 break-words text-sm text-ink-700">{message}</p>}
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" onClick={create} disabled={busy}>{busy ? 'Working…' : 'Create & download backup'}</Button>
      <input aria-label="Choose backup file" type="file" accept=".academy-backup,application/octet-stream" onChange={choose} disabled={busy} />
    </div>
    {details && <div className="mt-5 rounded-md border border-brick-600/30 bg-brick-100/40 p-4">
      <p className="text-sm"><strong>Selected backup:</strong> {new Date(details.createdAt).toLocaleString()} · {details.records} records in {details.collections} collections</p>
      <p className="mt-2 text-sm text-brick-600">Restoring replaces all current academy data. A safety backup is created automatically first.</p>
      <Field label="Type RESTORE to confirm"><TextInput value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></Field>
      <Button type="button" variant="danger" disabled={busy || confirmation !== 'RESTORE'} onClick={restore}>Restore database</Button>
    </div>}
  </section>;
}
