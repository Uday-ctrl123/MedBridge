import { useEffect, useState, useCallback } from 'react'
import { Search, ScrollText, Filter } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { AuditLogEntry } from '../../types/database'
import { PageHeader } from '../../components/ui/PageHeader'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'
import { ConfidenceBar } from '../../components/ui/ConfidenceBar'

const EVENT_FILTER_OPTIONS = [
  { value: '',                          label: 'All events' },
  { value: 'temporary_record_created',  label: 'Record created' },
  { value: 'patient_enrolled',          label: 'Patient enrolled' },
  { value: 'identification_attempted',  label: 'ID attempted' },
  { value: 'record_merged',             label: 'Record merged' },
]

const TYPE_DISPLAY: Record<string, { label: string; badge: string }> = {
  temporary_record_created: { label: 'Record created',    badge: 'badge-teal' },
  patient_enrolled:         { label: 'Patient enrolled',  badge: 'badge-sage' },
  identification_attempted: { label: 'ID attempted',      badge: 'badge-neutral' },
  record_merged:            { label: 'Record merged',     badge: 'badge-teal' },
}

function EventRow({ entry }: { entry: AuditLogEntry }) {
  const display = TYPE_DISPLAY[entry.event_type] ?? { label: entry.event_type, badge: 'badge-neutral' }
  const payload = entry.payload_summary as Record<string, unknown> | null

  // Extract confidence score from payload if present
  const score = typeof payload?.top_score === 'number' ? payload.top_score as number
    : typeof payload?.confidence_score === 'number' ? payload.confidence_score as number
    : null

  return (
    <tr className="hover:bg-ivory-50 transition-colors duration-100">
      <td className="px-5 py-4">
        <span className={display.badge}>{display.label}</span>
      </td>
      <td className="px-5 py-4">
        {entry.record_ref ? (
          <span className="font-mono text-xs text-charcoal-600">{entry.record_ref.slice(0, 8)}</span>
        ) : <span className="text-charcoal-300">—</span>}
      </td>
      <td className="px-5 py-4">
        {payload?.method ? (
          <span className="text-xs text-charcoal-600 capitalize">{String(payload.method).replace('_', ' ')}</span>
        ) : <span className="text-charcoal-300">—</span>}
      </td>
      <td className="px-5 py-4 w-36">
        {score !== null
          ? <ConfidenceBar score={score} />
          : <span className="text-charcoal-300 text-xs">—</span>
        }
      </td>
      <td className="px-5 py-4">
        {payload?.outcome ? (
          <span className={`text-xs font-medium ${
            payload.outcome === 'matched' ? 'text-teal-700' :
            payload.outcome === 'no_match' ? 'text-charcoal-500' : 'text-charcoal-500'
          }`}>
            {String(payload.outcome).replace('_', ' ')}
          </span>
        ) : payload?.auto_merged !== undefined ? (
          <span className="text-xs text-charcoal-600">
            {payload.auto_merged ? 'Auto-merged' : 'Reviewer approved'}
          </span>
        ) : <span className="text-charcoal-300 text-xs">—</span>}
      </td>
      <td className="px-5 py-4 text-charcoal-500 text-xs whitespace-nowrap">
        {new Date(entry.timestamp).toLocaleString(undefined, {
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
        })}
      </td>
    </tr>
  )
}

export function HospitalAuditLedger() {
  const { profile } = useAuth()
  const [entries,   setEntries]   = useState<AuditLogEntry[]>([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [eventType, setEventType] = useState('')
  const [page,      setPage]      = useState(0)
  const PAGE_SIZE = 20

  const load = useCallback(async () => {
    if (!profile?.hospital_id) return
    setLoading(true)
    let q = supabase
      .from('audit_log')
      .select('*')
      .eq('hospital_id', profile.hospital_id)
      .order('timestamp', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (eventType) q = q.eq('event_type', eventType)
    if (search.trim()) q = q.ilike('record_ref', `%${search.trim()}%`)

    const { data } = await q
    setEntries(data ?? [])
    setLoading(false)
  }, [profile?.hospital_id, eventType, page, search])

  useEffect(() => { load() }, [load])

  // Realtime subscription
  useEffect(() => {
    if (!profile?.hospital_id) return
    const channel = supabase
      .channel('hospital-audit-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'audit_log', filter: `hospital_id=eq.${profile.hospital_id}` },
        () => { if (page === 0 && !eventType && !search) load() }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [profile?.hospital_id, page, eventType, search, load])

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Audit Ledger"
        subtitle="Every identity event for this hospital — append-only, tamper-evident."
      />

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-52">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-charcoal-400" />
          <input
            className="input-field pl-9"
            placeholder="Search by record ref…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
          />
        </div>
        <div className="relative">
          <Filter size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-charcoal-400 pointer-events-none" />
          <select
            className="input-field pl-9 pr-8 appearance-none min-w-44"
            value={eventType}
            onChange={e => { setEventType(e.target.value); setPage(0) }}
          >
            {EVENT_FILTER_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Immutability note */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-ivory-100 border border-ivory-200 mb-5">
        <ScrollText size={13} className="text-charcoal-400 flex-shrink-0" />
        <p className="text-xs text-charcoal-500">
          This ledger is append-only at the database level. No entry can be edited or deleted by any user, including administrators.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No audit events yet"
          description="Identity events — admissions, identification attempts, merges — will appear here as they occur."
        />
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-ivory-200 bg-ivory-50">
                  {['Event', 'Record ref', 'Method', 'Confidence', 'Outcome', 'Time'].map(col => (
                    <th key={col} className="text-left px-5 py-3.5 text-xs font-medium text-charcoal-500 uppercase tracking-wide">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-ivory-100">
                {entries.map(e => <EventRow key={e.id} entry={e} />)}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-5 py-4 border-t border-ivory-200 flex items-center justify-between">
            <span className="text-xs text-charcoal-400">Page {page + 1}</span>
            <div className="flex gap-2">
              <button
                className="btn-secondary py-1.5 px-3 text-xs"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                Previous
              </button>
              <button
                className="btn-secondary py-1.5 px-3 text-xs"
                onClick={() => setPage(p => p + 1)}
                disabled={entries.length < PAGE_SIZE}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
