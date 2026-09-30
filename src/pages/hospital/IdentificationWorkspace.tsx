import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  Camera, Fingerprint, Eye, Dna, ChevronRight,
  CheckCircle2, AlertCircle, GitMerge, Info, User,
  ArrowLeft, Clock
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { extractFaceEmbedding, extractFingerprintVector, extractIrisVector } from '../../lib/biometrics'
import type { TemporaryRecord, Patient } from '../../types/database'
import { ConfidenceBar } from '../../components/ui/ConfidenceBar'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Spinner } from '../../components/ui/Spinner'
import { Modal } from '../../components/ui/Modal'

const HIGH_THRESHOLD = 0.90

/* ── Candidate card ───────────────────────────────────────── */
interface Candidate {
  patient_id: string
  score:      number
  confidence_label: string
  patient?:   Patient
}

function CandidateCard({
  candidate, selected, onSelect
}: { candidate: Candidate; selected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left rounded-xl border p-4 transition-all duration-150 ${
        selected
          ? 'border-teal-500 bg-teal-50 shadow-soft'
          : 'border-ivory-200 bg-white hover:border-teal-300 hover:bg-ivory-50'
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-charcoal-100 flex items-center justify-center flex-shrink-0">
            <User size={15} className="text-charcoal-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-charcoal-900">
              {candidate.patient?.name ?? `Patient ${candidate.patient_id.slice(0, 6)}`}
            </p>
            <p className="text-xs text-charcoal-400 font-mono mt-0.5">
              {candidate.patient_id.slice(0, 8)}
            </p>
          </div>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border flex-shrink-0 ${
          candidate.confidence_label === 'High'
            ? 'bg-teal-50 text-teal-700 border-teal-200'
            : candidate.confidence_label === 'Moderate'
            ? 'bg-sage-50 text-sage-700 border-sage-200'
            : 'bg-charcoal-100 text-charcoal-600 border-charcoal-200'
        }`}>
          {candidate.confidence_label}
        </span>
      </div>
      <ConfidenceBar score={candidate.score} />
      {selected && (
        <p className="mt-3 text-xs text-teal-700 font-medium flex items-center gap-1">
          <CheckCircle2 size={12} /> Selected for merge
        </p>
      )}
    </button>
  )
}

/* ── Merge confirmation modal ─────────────────────────────── */
function MergeModal({
  open, onClose, candidate, tempRecord, method, tier, onMerged
}: {
  open: boolean; onClose: () => void
  candidate: Candidate | null
  tempRecord: TemporaryRecord | null
  method: string; tier: number
  onMerged: () => void
}) {
  const { user } = useAuth()
  const [busy,    setBusy]    = useState(false)
  const [error,   setError]   = useState('')
  const needsReview = (candidate?.score ?? 0) < HIGH_THRESHOLD

  const merge = async () => {
    if (!candidate || !tempRecord || !user) return
    setBusy(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await supabase.functions.invoke('merge-record', {
        body: {
          temp_record_id:      tempRecord.id,
          verified_patient_id: candidate.patient_id,
          confidence_score:    candidate.score,
          resolving_tier:      tier,
          reviewer_id:         needsReview ? user.id : undefined,
          method,
        },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (res.data?.error || res.error) {
        setError(res.data?.error ?? res.error?.message ?? 'Merge failed.')
        return
      }
      onMerged()
      onClose()
    } catch (err) {
      setError('Unexpected error during merge.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Confirm identity merge">
      <div className="space-y-5">
        {candidate && (
          <>
            <div className="rounded-xl border border-ivory-200 bg-ivory-50 p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-charcoal-500">Temporary record</span>
                <span className="font-mono text-teal-700 font-medium">{tempRecord?.mrn}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-charcoal-500">Matched patient</span>
                <span className="font-medium text-charcoal-800">
                  {candidate.patient?.name ?? candidate.patient_id.slice(0, 8)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-charcoal-500">Method</span>
                <span className="text-charcoal-700">{method}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-charcoal-500">Confidence</span>
                <span className={`font-medium ${candidate.score >= HIGH_THRESHOLD ? 'text-teal-700' : 'text-charcoal-600'}`}>
                  {(candidate.score * 100).toFixed(1)}% — {candidate.confidence_label}
                </span>
              </div>
            </div>

            <ConfidenceBar score={candidate.score} />

            {needsReview ? (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-ivory-100 border border-ivory-300">
                <AlertCircle size={14} className="text-teal-800 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-charcoal-700 space-y-1">
                  <p className="font-medium">Reviewer approval required</p>
                  <p>
                    Confidence score is below the {(HIGH_THRESHOLD * 100).toFixed(0)}% auto-merge threshold.
                    By confirming, you are acting as the authorised reviewer for this merge.
                    This decision is logged immutably.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-teal-50 border border-teal-200">
                <CheckCircle2 size={14} className="text-teal-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-teal-700">
                  High confidence — this merge can proceed automatically. All clinical notes from the
                  temporary record will be carried forward to the verified patient chart.
                </p>
              </div>
            )}
          </>
        )}

        {error && (
          <div className="px-3 py-2 rounded-xl bg-ivory-100 border border-ivory-300 text-xs text-charcoal-700">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <button className="btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn-primary flex items-center gap-2" onClick={merge} disabled={busy}>
            {busy ? <Spinner size="sm" /> : <GitMerge size={15} />}
            {busy ? 'Merging…' : needsReview ? 'Approve & merge' : 'Merge records'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

/* ── Method tabs ──────────────────────────────────────────── */
type Method = 'face' | 'fingerprint' | 'iris' | 'dna'

const METHODS: Array<{ id: Method; label: string; icon: React.ElementType; tier: number; confirmatory?: boolean }> = [
  { id: 'face',        label: 'Face recognition',   icon: Camera,      tier: 0 },
  { id: 'fingerprint', label: 'Fingerprint',         icon: Fingerprint, tier: 0 },
  { id: 'iris',        label: 'Iris scan',           icon: Eye,         tier: 0 },
  { id: 'dna',         label: 'DNA / STR',           icon: Dna,         tier: 4, confirmatory: true },
]

/* ── Main page ────────────────────────────────────────────── */
export function IdentificationWorkspace() {
  const { id: recordId } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [record,     setRecord]     = useState<TemporaryRecord | null>(null)
  const [recLoading, setRecLoading] = useState(true)
  const [activeMethod, setActiveMethod] = useState<Method>('face')
  const [candidates,   setCandidates]   = useState<Candidate[]>([])
  const [selected,     setSelected]     = useState<Candidate | null>(null)
  const [matching,     setMatching]     = useState(false)
  const [matchMsg,     setMatchMsg]     = useState('')
  const [matchError,   setMatchError]   = useState('')
  const [showMerge,    setShowMerge]    = useState(false)
  const [merged,       setMerged]       = useState(false)

  // Capture state per method
  const videoRef = useRef<HTMLVideoElement>(null)
  const [camStream, setCamStream]   = useState<MediaStream | null>(null)
  const [camStatus, setCamStatus]   = useState<'idle' | 'active' | 'captured'>('idle')
  const [camError,  setCamError]    = useState('')

  // STR markers state
  const [strInput, setStrInput] = useState('')

  // Reset capture state when method changes
  useEffect(() => {
    camStream?.getTracks().forEach(t => t.stop())
    setCamStream(null)
    setCamStatus('idle')
    setCamError('')
    setCandidates([])
    setSelected(null)
    setMatchMsg('')
    setMatchError('')
  }, [activeMethod]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load record
  useEffect(() => {
    if (!recordId) return
    supabase
      .from('temporary_records')
      .select('*')
      .eq('id', recordId)
      .single()
      .then(({ data }) => {
        setRecord(data)
        setRecLoading(false)
      })
  }, [recordId])

  const startCamera = async () => {
    setCamError('')
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640 } })
      setCamStream(s)
      if (videoRef.current) videoRef.current.srcObject = s
      setCamStatus('active')
    } catch {
      setCamError('Camera access denied. Check browser permissions.')
    }
  }

  const captureFrame = async () => {
    if (!videoRef.current) return
    setMatching(true)
    const vec = await extractFaceEmbedding(videoRef.current)
    camStream?.getTracks().forEach(t => t.stop())
    setCamStream(null)
    setCamStatus('captured')
    await runMatch(vec, 'face')
  }

  const captureSimulated = async (modality: 'fingerprint' | 'iris') => {
    setMatching(true)
    const vec = modality === 'fingerprint'
      ? await extractFingerprintVector()
      : await extractIrisVector()
    setCamStatus('captured')
    await runMatch(vec, modality)
  }

  const runMatch = async (vec: number[], modality: 'face' | 'fingerprint' | 'iris') => {
    setMatchError('')
    setCandidates([])
    setMatching(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await supabase.functions.invoke('match-biometric', {
        body: { feature_vector: vec, modality, record_id: recordId },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (res.data?.error) { setMatchError(res.data.error); return }
      const raw: Candidate[] = res.data?.candidates ?? []
      // Enrich with patient names
      const enriched = await enrichCandidates(raw)
      setCandidates(enriched)
      setMatchMsg(res.data?.message ?? '')
    } catch {
      setMatchError('Match request failed. Check your connection.')
    } finally {
      setMatching(false)
    }
  }

  const runDNAMatch = async () => {
    if (!strInput.trim()) { setMatchError('Enter at least one STR marker.'); return }
    let parsed: Record<string, [number, number]>
    try {
      parsed = JSON.parse(strInput)
    } catch {
      setMatchError('Invalid JSON. Expected format: {"D3S1358":[15,17],"vWA":[14,18]}')
      return
    }
    setMatchError('')
    setCandidates([])
    setMatching(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await supabase.functions.invoke('match-dna', {
        body: { marker_set: parsed, record_id: recordId },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (res.data?.error) { setMatchError(res.data.error); return }
      const raw: Candidate[] = res.data?.candidates ?? []
      const enriched = await enrichCandidates(raw)
      setCandidates(enriched)
      setMatchMsg(res.data?.message ?? '')
    } catch {
      setMatchError('DNA match request failed.')
    } finally {
      setMatching(false)
    }
  }

  const enrichCandidates = useCallback(async (candidates: Candidate[]): Promise<Candidate[]> => {
    if (!candidates.length) return []
    const ids = candidates.map(c => c.patient_id)
    const { data: patients } = await supabase
      .from('patients')
      .select('id, name, date_of_birth')
      .in('id', ids)
      .returns<Pick<Patient, 'id' | 'name' | 'date_of_birth'>[]>()
    const map = Object.fromEntries((patients ?? []).map(p => [p.id, p]))
    return candidates.map(c => ({ ...c, patient: map[c.patient_id] as Patient | undefined }))
  }, [])

  if (recLoading) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  }

  if (!record) {
    return (
      <div className="text-center py-20 text-charcoal-500">
        <p>Record not found.</p>
        <Link to="/hospital/dashboard" className="btn-ghost mt-4 inline-flex">← Dashboard</Link>
      </div>
    )
  }

  if (merged || record.status === 'merged') {
    return (
      <div className="max-w-lg mx-auto py-20 text-center animate-slide-up">
        <div className="w-16 h-16 rounded-2xl bg-sage-50 border border-sage-200 flex items-center justify-center mx-auto mb-6">
          <GitMerge size={32} className="text-sage-600" />
        </div>
        <h2 className="text-2xl font-serif text-charcoal-900 mb-2">Record merged</h2>
        <p className="text-charcoal-500 text-sm mb-8">
          The temporary record <span className="font-mono font-semibold text-teal-700">{record.mrn}</span> has
          been merged into the verified patient chart. All clinical notes have been carried forward.
        </p>
        <button className="btn-primary" onClick={() => navigate('/hospital/dashboard')}>
          Back to dashboard
        </button>
      </div>
    )
  }

  const currentMethod = METHODS.find(m => m.id === activeMethod)!

  return (
    <div className="animate-fade-in">
      {/* Back + record header */}
      <div className="mb-8">
        <Link to="/hospital/dashboard" className="btn-ghost flex items-center gap-1.5 text-sm mb-6 -ml-2">
          <ArrowLeft size={15} /> Dashboard
        </Link>
        <div className="card flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center">
              <User size={20} className="text-teal-700" strokeWidth={1.75} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-mono text-sm text-teal-700 font-semibold">{record.mrn}</span>
                <StatusBadge status={record.status} />
              </div>
              <p className="text-sm text-charcoal-700 font-medium">{record.placeholder_name}</p>
              {(record.approx_sex || record.approx_age) && (
                <p className="text-xs text-charcoal-400">
                  {record.approx_sex}{record.approx_age ? ` · ~${record.approx_age}y` : ''}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-charcoal-500">
            <Clock size={13} />
            Admitted {new Date(record.admission_time).toLocaleString(undefined, {
              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — Method selector */}
        <div className="lg:col-span-1 space-y-2">
          <p className="label mb-3">Identification method</p>
          {METHODS.map(m => (
            <button
              key={m.id}
              onClick={() => setActiveMethod(m.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition-all duration-150 ${
                activeMethod === m.id
                  ? 'border-teal-500 bg-teal-50 text-teal-800 shadow-soft'
                  : 'border-ivory-200 bg-white text-charcoal-700 hover:border-charcoal-300 hover:bg-ivory-50'
              }`}
            >
              <m.icon size={16} strokeWidth={1.75} />
              <span className="flex-1 text-left">{m.label}</span>
              {m.confirmatory && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-ivory-200 text-charcoal-500">Confirmatory</span>
              )}
              <ChevronRight size={14} className="opacity-40" />
            </button>
          ))}

          <div className="mt-4 px-3 py-2 rounded-xl bg-ivory-100 border border-ivory-200 flex items-start gap-2">
            <Info size={12} className="text-charcoal-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-charcoal-500 leading-relaxed">
              Any method can resolve a case. DNA / STR is confirmatory and offered after biometric methods.
              Every attempt is logged immutably.
            </p>
          </div>
        </div>

        {/* Right — Active method panel */}
        <div className="lg:col-span-2 space-y-5">
          <div className="card space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <currentMethod.icon size={18} className="text-teal-700" strokeWidth={1.75} />
                <h2 className="section-title">{currentMethod.label}</h2>
                {currentMethod.confirmatory && (
                  <span className="badge-neutral text-xs">Confirmatory</span>
                )}
              </div>
            </div>

            {/* Face */}
            {activeMethod === 'face' && (
              <div className="space-y-4">
                <div className="aspect-video w-full max-w-sm mx-auto rounded-2xl overflow-hidden bg-charcoal-100 border border-charcoal-200 relative">
                  {camStatus === 'idle' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-charcoal-400">
                      <Camera size={28} strokeWidth={1.5} />
                      <p className="text-xs">Camera not started</p>
                    </div>
                  )}
                  <video ref={videoRef} autoPlay muted playsInline
                    className={`w-full h-full object-cover ${camStatus === 'active' ? 'block' : 'hidden'}`} />
                  {camStatus === 'captured' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-teal-950/80">
                      <CheckCircle2 size={28} className="text-teal-400" />
                      <p className="text-sm text-white">Embedding extracted</p>
                    </div>
                  )}
                </div>
                {camError && (
                  <p className="text-xs text-center text-charcoal-500">{camError}</p>
                )}
                <div className="flex justify-center gap-3">
                  {camStatus === 'idle' && (
                    <button className="btn-secondary flex items-center gap-2 text-sm" onClick={startCamera}>
                      <Camera size={14} /> Start camera
                    </button>
                  )}
                  {camStatus === 'active' && (
                    <button className="btn-primary flex items-center gap-2 text-sm" onClick={captureFrame} disabled={matching}>
                      {matching ? <Spinner size="sm" /> : <Camera size={14} />}
                      {matching ? 'Processing…' : 'Capture & match'}
                    </button>
                  )}
                  {camStatus === 'captured' && (
                    <button className="btn-ghost text-sm" onClick={() => { setCamStatus('idle'); setCandidates([]) }}>
                      Retake
                    </button>
                  )}
                </div>
                <p className="text-xs text-center text-charcoal-400 italic">
                  * Face matching uses simulated embeddings. Not for clinical use without validated hardware.
                </p>
              </div>
            )}

            {/* Fingerprint */}
            {activeMethod === 'fingerprint' && (
              <div className="space-y-4">
                <div className={`rounded-2xl border-2 p-8 text-center ${
                  camStatus === 'captured' ? 'border-teal-300 bg-teal-50' : 'border-dashed border-charcoal-200'
                }`}>
                  {camStatus === 'captured'
                    ? <CheckCircle2 size={32} className="text-teal-600 mx-auto mb-2" />
                    : <Fingerprint size={32} className="text-charcoal-400 mx-auto mb-2" strokeWidth={1.5} />
                  }
                  <p className="text-sm text-charcoal-600">
                    {camStatus === 'captured' ? 'Fingerprint vector extracted' : 'Simulated fingerprint scanner'}
                  </p>
                </div>
                {camStatus !== 'captured' && (
                  <div className="flex justify-center">
                    <button className="btn-secondary flex items-center gap-2 text-sm" onClick={() => captureSimulated('fingerprint')} disabled={matching}>
                      {matching ? <Spinner size="sm" /> : <Fingerprint size={14} />}
                      {matching ? 'Scanning…' : 'Simulate scan & match'}
                    </button>
                  </div>
                )}
                <p className="text-xs text-center text-charcoal-400 italic">
                  * Fingerprint matching is simulated — no hardware required.
                </p>
              </div>
            )}

            {/* Iris */}
            {activeMethod === 'iris' && (
              <div className="space-y-4">
                <div className={`rounded-2xl border-2 p-8 text-center ${
                  camStatus === 'captured' ? 'border-teal-300 bg-teal-50' : 'border-dashed border-charcoal-200'
                }`}>
                  {camStatus === 'captured'
                    ? <CheckCircle2 size={32} className="text-teal-600 mx-auto mb-2" />
                    : <Eye size={32} className="text-charcoal-400 mx-auto mb-2" strokeWidth={1.5} />
                  }
                  <p className="text-sm text-charcoal-600">
                    {camStatus === 'captured' ? 'Iris vector extracted' : 'Simulated iris scanner'}
                  </p>
                </div>
                {camStatus !== 'captured' && (
                  <div className="flex justify-center">
                    <button className="btn-secondary flex items-center gap-2 text-sm" onClick={() => captureSimulated('iris')} disabled={matching}>
                      {matching ? <Spinner size="sm" /> : <Eye size={14} />}
                      {matching ? 'Scanning…' : 'Simulate scan & match'}
                    </button>
                  </div>
                )}
                <p className="text-xs text-center text-charcoal-400 italic">
                  * Iris matching is simulated — no hardware required.
                </p>
              </div>
            )}

            {/* DNA / STR */}
            {activeMethod === 'dna' && (
              <div className="space-y-4">
                <div className="px-3 py-2.5 rounded-xl bg-ivory-100 border border-ivory-200 flex items-start gap-2">
                  <Info size={13} className="text-charcoal-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-charcoal-600 leading-relaxed">
                    Enter a JSON object of STR marker pairs, e.g.{' '}
                    <code className="font-mono bg-white px-1 rounded border border-charcoal-200">
                      {`{"D3S1358":[15,17],"vWA":[14,18]}`}
                    </code>
                    . Only markers in the enrolled dataset are compared.
                  </p>
                </div>
                <textarea
                  className="input-field font-mono text-sm min-h-[120px] resize-none"
                  placeholder={`{\n  "D3S1358": [15, 17],\n  "vWA": [14, 18],\n  "FGA": [22, 24]\n}`}
                  value={strInput}
                  onChange={e => setStrInput(e.target.value)}
                />
                <div className="flex justify-end">
                  <button className="btn-primary flex items-center gap-2 text-sm" onClick={runDNAMatch} disabled={matching}>
                    {matching ? <Spinner size="sm" /> : <Dna size={14} />}
                    {matching ? 'Comparing…' : 'Run STR comparison'}
                  </button>
                </div>
                <p className="text-xs text-charcoal-400 italic">
                  * DNA / STR comparison uses simulated weighted overlap scoring against enrolled marker sets only.
                  Never queries an external genetic database.
                </p>
              </div>
            )}
          </div>

          {/* Results */}
          {(matching || candidates.length > 0 || matchError || matchMsg) && (
            <div className="card space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-serif text-charcoal-800">Candidate matches</h3>
                {candidates.length > 0 && (
                  <span className="text-xs text-charcoal-500">{candidates.length} candidate{candidates.length !== 1 ? 's' : ''} found</span>
                )}
              </div>

              {matching && (
                <div className="flex items-center gap-3 py-4">
                  <Spinner size="sm" />
                  <p className="text-sm text-charcoal-500 animate-pulse-soft">Running comparison…</p>
                </div>
              )}

              {matchError && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-ivory-100 border border-ivory-300">
                  <AlertCircle size={14} className="text-teal-800 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-charcoal-700">{matchError}</p>
                </div>
              )}

              {!matching && matchMsg && candidates.length === 0 && (
                <p className="text-sm text-charcoal-500 py-4 text-center">{matchMsg}</p>
              )}

              {!matching && candidates.length > 0 && (
                <>
                  <div className="space-y-3">
                    {candidates.map(c => (
                      <CandidateCard
                        key={c.patient_id}
                        candidate={c}
                        selected={selected?.patient_id === c.patient_id}
                        onSelect={() => setSelected(s => s?.patient_id === c.patient_id ? null : c)}
                      />
                    ))}
                  </div>

                  {selected && (
                    <div className="flex justify-end pt-2">
                      <button
                        className="btn-primary flex items-center gap-2"
                        onClick={() => setShowMerge(true)}
                      >
                        <GitMerge size={15} />
                        {selected.score >= HIGH_THRESHOLD ? 'Merge records' : 'Review & merge'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <MergeModal
        open={showMerge}
        onClose={() => setShowMerge(false)}
        candidate={selected}
        tempRecord={record}
        method={currentMethod.label}
        tier={currentMethod.tier}
        onMerged={() => setMerged(true)}
      />
    </div>
  )
}
