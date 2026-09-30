import { useEffect, useState, useCallback } from 'react'
import { Plus, Building2, Trash2, AlertCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Hospital } from '../../types/database'
import { PageHeader } from '../../components/ui/PageHeader'
import { EmptyState } from '../../components/ui/EmptyState'
import { Modal } from '../../components/ui/Modal'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { FormField } from '../../components/ui/FormField'
import { Spinner } from '../../components/ui/Spinner'

/* ── Add Hospital Form ─────────────────────────────────────── */
function AddHospitalModal({ open, onClose, onAdded }: {
  open: boolean; onClose: () => void; onAdded: () => void
}) {
  const [form, setForm] = useState({
    name: '', address: '', city: '', contact_email: '', contact_person: '', password: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy,   setBusy]   = useState(false)
  const [apiErr, setApiErr] = useState('')

  const set = (k: string, v: string) => {
    setForm(f => ({ ...f, [k]: v }))
    if (errors[k]) setErrors(e => ({ ...e, [k]: '' }))
    setApiErr('')
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.name.trim())           e.name = 'Hospital name is required.'
    if (!form.contact_email.trim())  e.contact_email = 'Contact email is required.'
    if (!/\S+@\S+\.\S+/.test(form.contact_email)) e.contact_email = 'Enter a valid email address.'
    if (!form.password)              e.password = 'An initial password is required.'
    if (form.password.length < 8)   e.password = 'Password must be at least 8 characters.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setBusy(true)
    setApiErr('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await supabase.functions.invoke('create-hospital', {
        body: form,
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (res.error || res.data?.error) {
        setApiErr(res.data?.error ?? res.error?.message ?? 'An error occurred.')
        return
      }
      onAdded()
      onClose()
      setForm({ name: '', address: '', city: '', contact_email: '', contact_person: '', password: '' })
    } catch (err) {
      setApiErr('Unexpected error. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add hospital" maxWidth="lg">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Hospital name" required error={errors.name}>
            <input className="input-field" value={form.name}
              onChange={e => set('name', e.target.value)} placeholder="St. Mary's Medical" disabled={busy} />
          </FormField>
          <FormField label="City" error={errors.city}>
            <input className="input-field" value={form.city}
              onChange={e => set('city', e.target.value)} placeholder="San Francisco" disabled={busy} />
          </FormField>
        </div>
        <FormField label="Address">
          <input className="input-field" value={form.address}
            onChange={e => set('address', e.target.value)} placeholder="123 Main St, Suite 100" disabled={busy} />
        </FormField>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Contact email" required error={errors.contact_email}
            hint="This becomes the hospital login email.">
            <input className="input-field" type="email" value={form.contact_email}
              onChange={e => set('contact_email', e.target.value)} placeholder="er@hospital.org" disabled={busy} />
          </FormField>
          <FormField label="Contact person">
            <input className="input-field" value={form.contact_person}
              onChange={e => set('contact_person', e.target.value)} placeholder="Dr. Jane Smith" disabled={busy} />
          </FormField>
        </div>
        <FormField label="Initial password" required error={errors.password}
          hint="Share securely. Hospital staff should change this after first sign-in.">
          <input className="input-field" type="password" value={form.password}
            onChange={e => set('password', e.target.value)} placeholder="At least 8 characters" disabled={busy} />
        </FormField>

        {apiErr && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-ivory-100 border border-ivory-300">
            <AlertCircle size={14} className="text-teal-800 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-charcoal-700">{apiErr}</p>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn-primary flex items-center gap-2" disabled={busy}>
            {busy && <Spinner size="sm" />}
            {busy ? 'Creating…' : 'Create hospital'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/* ── Deactivate confirmation ───────────────────────────────── */
function DeactivateModal({ hospital, onClose, onDeactivated }: {
  hospital: Hospital | null; onClose: () => void; onDeactivated: () => void
}) {
  const [busy,   setBusy]   = useState(false)
  const [apiErr, setApiErr] = useState('')

  const handleConfirm = async () => {
    if (!hospital) return
    setBusy(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await supabase.functions.invoke('deactivate-hospital', {
        body: { hospital_id: hospital.id },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (res.error || res.data?.error) {
        setApiErr(res.data?.error ?? res.error?.message ?? 'Error deactivating.')
        return
      }
      onDeactivated()
      onClose()
    } catch {
      setApiErr('Unexpected error.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={!!hospital} onClose={onClose} title="Deactivate hospital">
      <div className="space-y-4">
        <p className="text-sm text-charcoal-700 leading-relaxed">
          This will mark <span className="font-medium">{hospital?.name}</span> as inactive and revoke
          login access. All patient records, audit history and clinical data are preserved.
        </p>
        {apiErr && (
          <div className="px-3 py-2 rounded-xl bg-ivory-100 border border-ivory-300 text-xs text-charcoal-700">
            {apiErr}
          </div>
        )}
        <div className="flex justify-end gap-3 pt-1">
          <button className="btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn-danger flex items-center gap-2" onClick={handleConfirm} disabled={busy}>
            {busy && <Spinner size="sm" />}
            {busy ? 'Deactivating…' : 'Deactivate hospital'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

/* ── Main page ─────────────────────────────────────────────── */
export function AdminHospitals() {
  const [hospitals,  setHospitals]  = useState<Hospital[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showAdd,    setShowAdd]    = useState(false)
  const [toDeactivate, setToDeactivate] = useState<Hospital | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('hospitals')
      .select('*')
      .order('created_at', { ascending: false })
    setHospitals(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Hospitals"
        subtitle="All client hospitals on the MedBridge platform."
        action={
          <button className="btn-primary flex items-center gap-2" onClick={() => setShowAdd(true)}>
            <Plus size={15} />
            Add hospital
          </button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : hospitals.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No hospitals yet"
          description="Add your first hospital to begin onboarding clinical staff."
          action={
            <button className="btn-primary flex items-center gap-2" onClick={() => setShowAdd(true)}>
              <Plus size={15} /> Add hospital
            </button>
          }
        />
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ivory-200 bg-ivory-50">
                {['Name', 'City', 'Contact email', 'Status', 'Added', ''].map(col => (
                  <th key={col} className="text-left px-5 py-3.5 text-xs font-medium text-charcoal-500 uppercase tracking-wide">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ivory-100">
              {hospitals.map(h => (
                <tr key={h.id} className="hover:bg-ivory-50 transition-colors duration-100">
                  <td className="px-5 py-4">
                    <div>
                      <p className="font-medium text-charcoal-900">{h.name}</p>
                      {h.contact_person && (
                        <p className="text-xs text-charcoal-400 mt-0.5">{h.contact_person}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-charcoal-600">{h.city ?? '—'}</td>
                  <td className="px-5 py-4 text-charcoal-600">{h.contact_email}</td>
                  <td className="px-5 py-4">
                    <StatusBadge status={h.status} />
                  </td>
                  <td className="px-5 py-4 text-charcoal-500 text-xs">
                    {new Date(h.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="px-5 py-4 text-right">
                    {h.status === 'active' && (
                      <button
                        onClick={() => setToDeactivate(h)}
                        className="text-charcoal-400 hover:text-charcoal-700 transition-colors p-1.5 rounded-lg hover:bg-ivory-100"
                        aria-label={`Deactivate ${h.name}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddHospitalModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onAdded={load}
      />
      <DeactivateModal
        hospital={toDeactivate}
        onClose={() => setToDeactivate(null)}
        onDeactivated={load}
      />
    </div>
  )
}
