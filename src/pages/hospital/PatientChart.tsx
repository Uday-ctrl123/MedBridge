import { useEffect, useState, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, User, FileText, Plus, Stethoscope,
  Activity, Bandage, ClipboardList, CheckCircle2
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { ClinicalNote, TemporaryRecord, Patient } from '../../types/database'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'

const NOTE_TYPE_META = {
  vitals:    { label: 'Vitals',    icon: Activity,     color: 'text-teal-700 bg-teal-50 border-teal-200' },
  injuries:  { label: 'Injuries',  icon: Bandage,      color: 'text-charcoal-700 bg-ivory-100 border-ivory-200' },
  treatment: { label: 'Treatment', icon: Stethoscope,  color: 'text-sage-700 bg-sage-50 border-sage-200' },
  general:   { label: 'General',   icon: ClipboardList, color: 'text-charcoal-600 bg-charcoal-50 border-charcoal-200' },
} as const

type NoteType = keyof typeof NOTE_TYPE_META

interface RecordMeta {
  type: 'temporary' | 'verified'
  mrn?: string
  name: string
  admissionTime?: string
  status?: string
  dob?: string
}

function NoteCard({ note }: { note: ClinicalNote }) {
  const meta = NOTE_TYPE_META[note.note_type as NoteType] ?? NOTE_TYPE_META.general
  const Icon = meta.icon
  return (
    <div className="rounded-xl border border-ivory-200 bg-white p-4 space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border text-xs font-medium ${meta.color}`}>
          <Icon size={12} strokeWidth={2} />
          {meta.label}
        </div>
        <time className="text-xs text-charcoal-400">
          {new Date(note.created_at).toLocaleString(undefined, {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
          })}
        </time>
      </div>
      <p className="text-sm text-charcoal-800 whitespace-pre-wrap leading-relaxed">{note.content}</p>
    </div>
  )
}

function AddNoteInline({
  recordId, recordType, hospitalId, userId, onAdded
}: {
  recordId: string; recordType: 'temporary' | 'verified'
  hospitalId: string; userId: string; onAdded: () => void
}) {
  const [open,    setOpen]    = useState(false)
  const [type,    setType]    = useState<NoteType>('vitals')
  const [content, setContent] = useState('')
  const [busy,    setBusy]    = useState(false)
  const [error,   setError]   = useState('')

  const submit = async () => {
    if (!content.trim()) { setError('Note content is required.'); return }
    setBusy(true)
    const { error: dbErr } = await supabase
      .from('clinical_notes')
      .insert({
        record_id:   recordId,
        record_type: recordType,
        hospital_id: hospitalId,
        note_type:   type,
        content:     content.trim(),
        author_id:   userId,
      } as never)
    if (dbErr) { setError(dbErr.message); setBusy(false); return }
    setContent('')
    setOpen(false)
    setBusy(false)
    onAdded()
  }

  if (!open) {
    return (
      <button
        className="btn-secondary flex items-center gap-2 text-sm"
        onClick={() => setOpen(true)}
      >
        <Plus size={14} /> Add clinical note
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-charcoal-700">New clinical note</p>
        <button
          className="text-xs text-charcoal-400 hover:text-charcoal-600"
          onClick={() => { setOpen(false); setError('') }}
        >
          Cancel
        </button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {(Object.keys(NOTE_TYPE_META) as NoteType[]).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`py-2 rounded-xl border text-xs font-medium transition-all ${
              type === t
                ? 'border-teal-500 bg-teal-100 text-teal-800'
                : 'border-ivory-200 bg-white text-charcoal-600 hover:border-charcoal-300'
            }`}
          >
            {NOTE_TYPE_META[t].label}
          </button>
        ))}
      </div>
      <textarea
        className="input-field min-h-[100px] resize-none bg-white text-sm"
        placeholder="Enter note content…"
        value={content}
        onChange={e => { setContent(e.target.value); setError('') }}
        disabled={busy}
        autoFocus
      />
      {error && <p className="text-xs text-teal-900">{error}</p>}
      <div className="flex justify-end gap-2">
        <button className="btn-primary text-sm flex items-center gap-2" onClick={submit} disabled={busy}>
          {busy ? <Spinner size="sm" /> : <CheckCircle2 size={13} />}
          {busy ? 'Saving…' : 'Save note'}
        </button>
      </div>
    </div>
  )
}

export function PatientChart() {
  const { type, id } = useParams<{ type: string; id: string }>()
  const { profile, user } = useAuth()
  const navigate = useNavigate()

  const [meta,    setMeta]    = useState<RecordMeta | null>(null)
  const [notes,   setNotes]   = useState<ClinicalNote[]>([])
  const [loading, setLoading] = useState(true)

  const isTemp = type === 'temporary'
  const hospitalId = profile?.hospital_id ?? ''

  const loadNotes = useCallback(async () => {
    if (!id || !hospitalId) return
    const { data } = await supabase
      .from('clinical_notes')
      .select('*')
      .eq('record_id', id)
      .eq('hospital_id', hospitalId)
      .order('created_at', { ascending: false })
    setNotes((data ?? []) as ClinicalNote[])
  }, [id, hospitalId])

  useEffect(() => {
    if (!id || !hospitalId) return
    const load = async () => {
      setLoading(true)
      if (isTemp) {
        const { data } = await supabase
          .from('temporary_records')
          .select('*')
          .eq('id', id)
          .eq('hospital_id', hospitalId)
          .maybeSingle()
        if (data) {
          const rec = data as TemporaryRecord
          setMeta({
            type: 'temporary',
            mrn:           rec.mrn,
            name:          rec.placeholder_name,
            admissionTime: rec.admission_time,
            status:        rec.status,
          })
        }
      } else {
        const { data } = await supabase
          .from('patients')
          .select('*')
          .eq('id', id)
          .eq('hospital_id', hospitalId)
          .maybeSingle()
        if (data) {
          const pat = data as Patient
          setMeta({
            type: 'verified',
            name:   pat.name,
            dob:    pat.date_of_birth ?? undefined,
            status: pat.enrollment_status,
          })
        }
      }
      await loadNotes()
      setLoading(false)
    }
    load()
  }, [id, isTemp, hospitalId, loadNotes])

  if (loading) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  }

  if (!meta) {
    return (
      <div className="text-center py-20 text-charcoal-500">
        <p>Record not found.</p>
        <Link to="/hospital/dashboard" className="btn-ghost mt-4 inline-flex">← Dashboard</Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      {/* Back */}
      <button onClick={() => navigate(-1)} className="btn-ghost flex items-center gap-1.5 text-sm mb-6 -ml-2">
        <ArrowLeft size={15} /> Back
      </button>

      {/* Record header */}
      <div className="card mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-charcoal-100 border border-charcoal-200 flex items-center justify-center">
              <User size={22} className="text-charcoal-500" strokeWidth={1.5} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-serif text-charcoal-900">{meta.name}</h1>
                {meta.mrn && (
                  <span className="font-mono text-xs bg-teal-50 text-teal-700 px-2 py-0.5 rounded border border-teal-100">
                    {meta.mrn}
                  </span>
                )}
                {meta.status && <StatusBadge status={meta.status} />}
                {meta.type === 'temporary' && (
                  <span className="text-xs px-2 py-0.5 rounded-full border bg-ivory-100 text-charcoal-600 border-ivory-300">
                    Temporary record
                  </span>
                )}
              </div>
              <div className="text-xs text-charcoal-400 mt-1 space-x-3">
                {meta.dob && <span>DOB {meta.dob}</span>}
                {meta.admissionTime && (
                  <span>Admitted {new Date(meta.admissionTime).toLocaleString(undefined, {
                    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
                  })}</span>
                )}
              </div>
            </div>
          </div>
          {isTemp && meta.status === 'open' && (
            <Link
              to={`/hospital/identify/${id}`}
              className="btn-secondary text-sm flex items-center gap-2"
            >
              Start identification
            </Link>
          )}
        </div>
      </div>

      {/* Notes section */}
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="section-title">Clinical notes</h2>
            <p className="text-xs text-charcoal-400 mt-0.5">Append-only — notes cannot be edited or deleted.</p>
          </div>
          {hospitalId && user && (
            <AddNoteInline
              recordId={id!}
              recordType={isTemp ? 'temporary' : 'verified'}
              hospitalId={hospitalId}
              userId={user.id}
              onAdded={loadNotes}
            />
          )}
        </div>

        {notes.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No clinical notes yet"
            description="Add vitals, injuries, treatment notes, or general observations. Notes are attached immediately — no identity required."
          />
        ) : (
          <div className="space-y-3">
            {notes.map(note => <NoteCard key={note.id} note={note} />)}
          </div>
        )}
      </div>
    </div>
  )
}
