import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircle2, Camera, Fingerprint, Eye, Dna,
  ChevronRight, ChevronLeft, AlertCircle, Info
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { extractFaceEmbedding, extractFingerprintVector, extractIrisVector } from '../../lib/biometrics'
import { PageHeader } from '../../components/ui/PageHeader'
import { FormField } from '../../components/ui/FormField'
import { Spinner } from '../../components/ui/Spinner'

/* ── Step indicator ───────────────────────────────────────── */
const STEPS = ['Consent', 'Identity', 'Biometrics', 'DNA / STR', 'Review']

function StepDots({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2 mb-10">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div className={`flex items-center gap-2 ${i < current ? 'opacity-100' : i === current ? 'opacity-100' : 'opacity-40'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium border transition-all ${
              i < current  ? 'bg-teal-600 border-teal-600 text-white' :
              i === current? 'border-teal-600 text-teal-700 bg-teal-50' :
                             'border-charcoal-200 text-charcoal-400 bg-white'
            }`}>
              {i < current ? <CheckCircle2 size={13} /> : i + 1}
            </div>
            <span className={`text-xs font-medium hidden sm:block ${i === current ? 'text-charcoal-800' : 'text-charcoal-400'}`}>
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`w-8 h-px ${i < current ? 'bg-teal-400' : 'bg-charcoal-200'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

/* ── Webcam capture component ─────────────────────────────── */
function WebcamCapture({ onCapture }: { onCapture: (vec: number[]) => void }) {
  const videoRef   = useRef<HTMLVideoElement>(null)
  const [stream,   setStream]   = useState<MediaStream | null>(null)
  const [status,   setStatus]   = useState<'idle' | 'active' | 'captured'>('idle')
  const [busy,     setBusy]     = useState(false)
  const [camError, setCamError] = useState('')

  const startCamera = async () => {
    setCamError('')
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640 } })
      setStream(s)
      if (videoRef.current) videoRef.current.srcObject = s
      setStatus('active')
    } catch {
      setCamError('Camera access denied or unavailable. You can skip face capture and use other methods.')
    }
  }

  const stopCamera = useCallback(() => {
    stream?.getTracks().forEach(t => t.stop())
    setStream(null)
  }, [stream])

  const capture = async () => {
    if (!videoRef.current) return
    setBusy(true)
    const vec = await extractFaceEmbedding(videoRef.current)
    stopCamera()
    setStatus('captured')
    setBusy(false)
    onCapture(vec)
  }

  return (
    <div className="space-y-3">
      <div className="aspect-video w-full max-w-sm mx-auto rounded-2xl overflow-hidden bg-charcoal-100 border border-charcoal-200 relative">
        {status === 'idle' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-charcoal-400">
            <Camera size={32} strokeWidth={1.5} />
            <p className="text-xs">Camera not started</p>
          </div>
        )}
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className={`w-full h-full object-cover ${status === 'active' ? 'block' : 'hidden'}`}
        />
        {status === 'captured' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-teal-950/80">
            <CheckCircle2 size={32} className="text-teal-400" />
            <p className="text-sm text-white">Embedding captured</p>
          </div>
        )}
      </div>

      {camError && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-ivory-100 border border-ivory-300 text-xs text-charcoal-600">
          <AlertCircle size={13} className="mt-0.5 flex-shrink-0 text-teal-800" />
          {camError}
        </div>
      )}

      <div className="flex justify-center gap-3">
        {status === 'idle' && (
          <button type="button" className="btn-secondary flex items-center gap-2 text-sm" onClick={startCamera}>
            <Camera size={14} /> Start camera
          </button>
        )}
        {status === 'active' && (
          <button type="button" className="btn-primary flex items-center gap-2 text-sm" onClick={capture} disabled={busy}>
            {busy ? <Spinner size="sm" /> : <Camera size={14} />}
            {busy ? 'Processing…' : 'Capture face'}
          </button>
        )}
        {status === 'captured' && (
          <button type="button" className="btn-ghost text-sm" onClick={() => { setStatus('idle'); stopCamera() }}>
            Retake
          </button>
        )}
      </div>
    </div>
  )
}

/* ── Simulated capture button (fingerprint / iris) ────────── */
function SimulatedCapture({
  label, icon: Icon, onCapture, modality
}: {
  label: string; icon: React.ElementType; onCapture: (vec: number[]) => void; modality: 'fingerprint' | 'iris'
}) {
  const [status, setStatus] = useState<'idle' | 'busy' | 'done'>('idle')

  const run = async () => {
    setStatus('busy')
    const vec = modality === 'fingerprint'
      ? await extractFingerprintVector()
      : await extractIrisVector()
    setStatus('done')
    onCapture(vec)
  }

  return (
    <div className={`rounded-2xl border-2 p-6 text-center transition-all duration-200 ${
      status === 'done' ? 'border-teal-300 bg-teal-50' : 'border-dashed border-charcoal-200 bg-ivory-50'
    }`}>
      <div className="flex justify-center mb-3">
        {status === 'done'
          ? <CheckCircle2 size={28} className="text-teal-600" />
          : <Icon size={28} className="text-charcoal-400" strokeWidth={1.5} />
        }
      </div>
      <p className="text-sm font-medium text-charcoal-700 mb-1">{label}</p>
      <p className="text-xs text-charcoal-400 mb-4">Simulated — no hardware required</p>
      {status !== 'done' ? (
        <button type="button" className="btn-secondary text-sm flex items-center gap-2 mx-auto" onClick={run} disabled={status === 'busy'}>
          {status === 'busy' ? <Spinner size="sm" /> : null}
          {status === 'busy' ? 'Scanning…' : 'Simulate capture'}
        </button>
      ) : (
        <div className="flex items-center justify-center gap-1.5">
          <span className="badge-teal">Vector stored</span>
          <button type="button" className="btn-ghost text-xs py-1 px-2" onClick={() => setStatus('idle')}>
            Redo
          </button>
        </div>
      )}
    </div>
  )
}

/* ── STR marker entry ─────────────────────────────────────── */
const STR_LOCI = ['D3S1358', 'vWA', 'FGA', 'D8S1179', 'D21S11', 'D18S51', 'D5S818', 'D13S317', 'D7S820']

function STREntry({ markers, onChange }: {
  markers: Record<string, [string, string]>; onChange: (m: Record<string, [string, string]>) => void
}) {
  const set = (locus: string, idx: 0 | 1, val: string) => {
    const next = { ...markers, [locus]: [...(markers[locus] ?? ['', ''])] as [string, string] }
    next[locus][idx] = val.replace(/\D/g, '')
    onChange(next)
  }
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-ivory-100 border border-ivory-200">
        <Info size={13} className="text-charcoal-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-charcoal-500">
          Enter allele pairs for each STR locus. Leave blank to skip a locus.
          Only enrolled marker sets are stored — no full genomic data.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {STR_LOCI.map(locus => (
          <div key={locus} className="flex items-center gap-3 p-3 rounded-xl bg-white border border-ivory-200">
            <span className="text-xs font-mono font-medium text-charcoal-600 w-20 flex-shrink-0">{locus}</span>
            <div className="flex gap-2 flex-1">
              <input
                className="input-field text-center py-2 text-sm"
                placeholder="—"
                value={markers[locus]?.[0] ?? ''}
                onChange={e => set(locus, 0, e.target.value)}
                maxLength={4}
              />
              <input
                className="input-field text-center py-2 text-sm"
                placeholder="—"
                value={markers[locus]?.[1] ?? ''}
                onChange={e => set(locus, 1, e.target.value)}
                maxLength={4}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Main Page ────────────────────────────────────────────── */
interface EnrollmentState {
  // Step 2
  name: string; dob: string; contact: string
  // Step 3
  faceVec:        number[] | null
  fingerprintVec: number[] | null
  irisVec:        number[] | null
  // Step 4
  strMarkers: Record<string, [string, string]>
  strConsent: boolean
}

export function PatientEnrollment() {
  const { profile, user } = useAuth()
  const navigate = useNavigate()
  const [step, setStep]   = useState(0)
  const [data, setData]   = useState<EnrollmentState>({
    name: '', dob: '', contact: '',
    faceVec: null, fingerprintVec: null, irisVec: null,
    strMarkers: {}, strConsent: false,
  })
  const [errors,    setErrors]    = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [done,       setDone]      = useState(false)
  const [apiError,   setApiError]  = useState('')

  const next = () => {
    if (step === 1) {
      const e: Record<string, string> = {}
      if (!data.name.trim()) e.name = 'Full name is required.'
      setErrors(e)
      if (Object.keys(e).length) return
    }
    setStep(s => s + 1)
  }
  const back = () => setStep(s => s - 1)

  const hasBiometric = data.faceVec || data.fingerprintVec || data.irisVec

  const submit = async () => {
    if (!profile?.hospital_id || !user) return
    setSubmitting(true)
    setApiError('')
    try {
      // 1. Create patient record
      const { data: patient, error: patErr } = await supabase
        .from('patients')
        .insert({
          hospital_id:       profile.hospital_id as string,
          name:              data.name,
          date_of_birth:     data.dob || null,
          contact:           data.contact || null,
          enrollment_status: 'enrolled',
        } as never)
        .select('id, name')
        .single()

      if (patErr || !patient) throw new Error(patErr?.message ?? 'Failed to create patient.')
      const patientRow = patient as { id: string; name: string }

      // 2. Store biometric templates
      const templates: Array<{ modality: 'face' | 'fingerprint' | 'iris'; vec: number[] }> = []
      if (data.faceVec)        templates.push({ modality: 'face',        vec: data.faceVec })
      if (data.fingerprintVec) templates.push({ modality: 'fingerprint', vec: data.fingerprintVec })
      if (data.irisVec)        templates.push({ modality: 'iris',        vec: data.irisVec })

      for (const t of templates) {
        await supabase.from('biometric_templates').insert({
          patient_id:     patientRow.id,
          hospital_id:    profile.hospital_id as string,
          modality:       t.modality,
          feature_vector: JSON.stringify(t.vec),
        } as never)
      }

      // 3. Store STR profile if markers were entered and consented
      const filledMarkers = Object.entries(data.strMarkers)
        .filter(([, v]) => v[0] || v[1])
        .reduce<Record<string, [number, number]>>((acc, [k, v]) => {
          acc[k] = [parseInt(v[0]) || 0, parseInt(v[1]) || 0]
          return acc
        }, {})

      if (data.strConsent && Object.keys(filledMarkers).length > 0) {
        await supabase.from('str_profiles').insert({
          patient_id:  patientRow.id,
          hospital_id: profile.hospital_id as string,
          marker_set:  JSON.stringify(filledMarkers),
        } as never)
      }

      // 4. Audit log
      await supabase.from('audit_log').insert({
        hospital_id:     profile.hospital_id as string,
        event_type:      'patient_enrolled',
        actor_id:        user.id,
        record_ref:      patientRow.id,
        payload_summary: {
          name:       data.name,
          modalities: templates.map(t => t.modality),
          str:        data.strConsent && Object.keys(filledMarkers).length > 0,
        },
      } as never)

      setDone(true)
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'An unexpected error occurred.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="max-w-lg mx-auto py-20 text-center animate-slide-up">
        <div className="w-16 h-16 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 size={32} className="text-teal-600" />
        </div>
        <h2 className="text-2xl font-serif text-charcoal-900 mb-2">Enrollment complete</h2>
        <p className="text-charcoal-500 text-sm mb-8 max-w-xs mx-auto">
          {data.name}'s biometric templates and STR profile have been securely stored.
          No raw images or genomic sequences were retained.
        </p>
        <div className="flex gap-3 justify-center">
          <button className="btn-secondary" onClick={() => { setDone(false); setStep(0); setData({ name: '', dob: '', contact: '', faceVec: null, fingerprintVec: null, irisVec: null, strMarkers: {}, strConsent: false }) }}>
            Enroll another
          </button>
          <button className="btn-primary" onClick={() => navigate('/hospital/dashboard')}>
            Back to dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <PageHeader title="Enroll patient" subtitle="Capture biometric templates and optional STR markers with explicit consent." />
      <StepDots current={step} />

      {/* Step 0 — Consent */}
      {step === 0 && (
        <div className="card space-y-6">
          <h2 className="section-title">Patient consent</h2>
          <div className="prose-sm text-charcoal-600 space-y-4 leading-relaxed text-sm">
            <p>
              MedBridge collects biometric feature vectors and, optionally, Short Tandem Repeat (STR)
              marker sets for the purpose of emergency identity resolution. The following applies:
            </p>
            <ul className="space-y-2 pl-4">
              {[
                'Raw images and photographs are discarded immediately after vector extraction.',
                'No full genomic sequences are captured or stored.',
                'Biometric vectors are encrypted at rest and stored separately from clinical notes.',
                'STR marker sets are used solely for identity confirmation — never for ancestry or medical inference.',
                'Data is retained for as long as required by your healthcare provider and applicable law.',
                'Treatment proceeds under implied-consent doctrine in emergency situations regardless of enrollment status.',
              ].map(p => (
                <li key={p} className="flex items-start gap-2">
                  <CheckCircle2 size={13} className="text-teal-600 mt-0.5 flex-shrink-0" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              className="mt-0.5 w-4 h-4 accent-teal-700 rounded"
              onChange={e => setData(d => ({ ...d, strConsent: e.target.checked }))}
              checked={data.strConsent}
            />
            <span className="text-sm text-charcoal-700">
              The patient (or their authorized representative) has provided informed consent for biometric
              enrollment and optional STR marker collection.
            </span>
          </label>
          <div className="flex justify-end">
            <button className="btn-primary flex items-center gap-2" onClick={next}>
              Continue <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Step 1 — Identity */}
      {step === 1 && (
        <div className="card space-y-5">
          <h2 className="section-title">Patient identity</h2>
          <FormField label="Full name" required error={errors.name}>
            <input className="input-field" value={data.name}
              onChange={e => setData(d => ({ ...d, name: e.target.value }))}
              placeholder="Jane Doe" />
          </FormField>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Date of birth">
              <input className="input-field" type="date" value={data.dob}
                onChange={e => setData(d => ({ ...d, dob: e.target.value }))} />
            </FormField>
            <FormField label="Contact">
              <input className="input-field" value={data.contact}
                onChange={e => setData(d => ({ ...d, contact: e.target.value }))}
                placeholder="+1 555 000 0000" />
            </FormField>
          </div>
          <div className="flex justify-between pt-2">
            <button className="btn-ghost flex items-center gap-1" onClick={back}><ChevronLeft size={15} />Back</button>
            <button className="btn-primary flex items-center gap-2" onClick={next}>Continue <ChevronRight size={15} /></button>
          </div>
        </div>
      )}

      {/* Step 2 — Biometrics */}
      {step === 2 && (
        <div className="card space-y-8">
          <div>
            <h2 className="section-title">Biometric capture</h2>
            <p className="text-sm text-charcoal-500 mt-1">At least one modality is recommended. All are optional — you may skip this step entirely.</p>
          </div>

          {/* Face */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Camera size={16} className="text-teal-700" strokeWidth={1.75} />
              <h3 className="text-sm font-medium text-charcoal-800">Face recognition</h3>
              {data.faceVec && <span className="badge-teal ml-auto">Captured</span>}
            </div>
            <WebcamCapture onCapture={vec => setData(d => ({ ...d, faceVec: vec }))} />
          </div>

          <div className="divider" />

          {/* Fingerprint + Iris */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Fingerprint size={16} className="text-teal-700" strokeWidth={1.75} />
              <h3 className="text-sm font-medium text-charcoal-800">Fingerprint &amp; Iris</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SimulatedCapture
                label="Fingerprint scan"
                icon={Fingerprint}
                modality="fingerprint"
                onCapture={vec => setData(d => ({ ...d, fingerprintVec: vec }))}
              />
              <SimulatedCapture
                label="Iris scan"
                icon={Eye}
                modality="iris"
                onCapture={vec => setData(d => ({ ...d, irisVec: vec }))}
              />
            </div>
          </div>

          <p className="text-xs text-charcoal-400 italic">
            * Fingerprint and iris matching are simulated. Face recognition uses client-side embedding extraction.
          </p>

          <div className="flex justify-between pt-2">
            <button className="btn-ghost flex items-center gap-1" onClick={back}><ChevronLeft size={15} />Back</button>
            <button className="btn-primary flex items-center gap-2" onClick={next}>
              {hasBiometric ? 'Continue' : 'Skip biometrics'} <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — STR */}
      {step === 3 && (
        <div className="card space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Dna size={16} className="text-teal-700" strokeWidth={1.75} />
              <h2 className="section-title">DNA / STR markers</h2>
              <span className="badge-neutral ml-2">Optional</span>
            </div>
            <p className="text-sm text-charcoal-500">
              STR markers are only collected if the patient provided explicit STR consent in step 1.
              Leave all fields blank to skip.
            </p>
          </div>

          {!data.strConsent ? (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-ivory-100 border border-ivory-200">
              <AlertCircle size={14} className="text-charcoal-400 flex-shrink-0" />
              <p className="text-sm text-charcoal-600">
                STR consent was not given in step 1. You can still proceed — no STR data will be collected.
              </p>
            </div>
          ) : (
            <STREntry markers={data.strMarkers} onChange={m => setData(d => ({ ...d, strMarkers: m }))} />
          )}

          <div className="flex justify-between pt-2">
            <button className="btn-ghost flex items-center gap-1" onClick={back}><ChevronLeft size={15} />Back</button>
            <button className="btn-primary flex items-center gap-2" onClick={next}>Continue <ChevronRight size={15} /></button>
          </div>
        </div>
      )}

      {/* Step 4 — Review */}
      {step === 4 && (
        <div className="card space-y-6">
          <h2 className="section-title">Review &amp; confirm</h2>

          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="label">Name</p>
                <p className="text-charcoal-800 font-medium">{data.name}</p>
              </div>
              <div>
                <p className="label">Date of birth</p>
                <p className="text-charcoal-800">{data.dob || '—'}</p>
              </div>
            </div>

            <div className="divider" />

            <div>
              <p className="label">Biometric modalities captured</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {data.faceVec        && <span className="badge-teal">Face</span>}
                {data.fingerprintVec && <span className="badge-teal">Fingerprint</span>}
                {data.irisVec        && <span className="badge-teal">Iris</span>}
                {!hasBiometric && <span className="badge-neutral">None</span>}
              </div>
            </div>

            <div>
              <p className="label">STR markers</p>
              <p className="text-charcoal-700">
                {data.strConsent && Object.keys(data.strMarkers).some(k => data.strMarkers[k]?.[0])
                  ? `${Object.keys(data.strMarkers).filter(k => data.strMarkers[k]?.[0]).length} loci entered`
                  : 'Not collected'
                }
              </p>
            </div>

            <div className="px-4 py-3 rounded-xl bg-teal-50 border border-teal-100">
              <p className="text-xs text-teal-800">
                No raw images or genomic sequences will be persisted. Only feature vectors and
                marker sets are stored, encrypted at rest.
              </p>
            </div>
          </div>

          {apiError && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-ivory-100 border border-ivory-300">
              <AlertCircle size={14} className="text-teal-800 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-charcoal-700">{apiError}</p>
            </div>
          )}

          <div className="flex justify-between pt-2">
            <button className="btn-ghost flex items-center gap-1" onClick={back} disabled={submitting}>
              <ChevronLeft size={15} />Back
            </button>
            <button className="btn-primary flex items-center gap-2" onClick={submit} disabled={submitting}>
              {submitting ? <Spinner size="sm" /> : null}
              {submitting ? 'Enrolling…' : 'Confirm enrollment'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
