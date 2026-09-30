import { useEffect, useState, useCallback } from 'react'
import { Search, ScrollText, Filter } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { AuditLogEntry } from '../../types/database'
import { PageHeader } from '../../components/ui/PageHeader'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'

const EVENT_TYPES = [
  { value: '',                        label: 'All events' },
  { value: 'hospital_created',        label: 'Hospital added' },
  { value: 'hospital_deactivated',    label: 'Hospital deactivated' },
  { value: 'identification_attempted',label: 'ID attempted' },
  { value: 'record_merged',           label: 'Record merged' },
]

const typeLabel: Record<string, string> = {
  hospital_created:       'Hospital added',
  hospital_deactivated:   'Hospital deactivated',
  identification_attempted: 'ID attempted',
  record_merged:          'Record merged',
}

const typeBadge: Record<string, string> = {
  hospital_created:       'badge-teal',
  hospital_deactivated:   'badge-neutral',
  identification_attempted: 'badge-sage',
  record_merged:          'badge-teal',
}

export function AdminAuditLog() {
  const [entries,   setEntries]   = useState<AuditLogEntry[]>([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [eventType, setEventType] = useState('')
  const [page,      setPage]      = useState(0)
  const PAGE_SIZE = 20

  const load = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('audit_log')
      .select('*')
      .order('timestamp', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (eventType) q = q.eq('event_type', eventType)
    if (search.trim()) q = q.ilike('record_ref', `%${search.trim()}%`)

    const { data } = await q
    setEntries(data ?? [])
    setLoading(false)
  }, [eventType, page, search])

  useEffect(() => { load() }, [load])

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Audit Log"
        subtitle="Append-only platform event log. No entry can be modified or deleted."
      />

      {/* Filters */}
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
            className="input-field pl-9 pr-8 appearance-none"
            value={eventType}
            onChange={e => { setEventType(e.target.value); setPage(0) }}
          >
            {EVENT_TYPES.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No events found"
          description="Try adjusting your filters, or wait for platform activity to appear here."
        />
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ivory-200 bg-ivory-50">
                {['Event', 'Record ref', 'Actor', 'Details', 'Time'].map(col => (
                  <th key={col} className="text-left px-5 py-3.5 text-xs font-medium text-charcoal-500 uppercase tracking-wide">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ivory-100">
              {entries.map(e => (
                <tr key={e.id} className="hover:bg-ivory-50 transition-colors duration-100">
                  <td className="px-5 py-3.5">
                    <span className={typeBadge[e.event_type] ?? 'badge-neutral'}>
                      {typeLabel[e.event_type] ?? e.event_type}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    {e.record_ref ? (
                      <span className="font-mono text-xs text-charcoal-600">{e.record_ref.slice(0, 8)}</span>
                    ) : (
                      <span className="text-charcoal-300">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-charcoal-500">
                    {e.actor_id ? (
                      <span className="font-mono text-xs">{e.actor_id.slice(0, 8)}</span>
                    ) : (
                      <span className="text-charcoal-300">system</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-charcoal-400 text-xs max-w-xs truncate">
                    {e.payload_summary
                      ? Object.entries(e.payload_summary as Record<string, unknown>)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(' · ')
                      : '—'
                    }
                  </td>
                  <td className="px-5 py-3.5 text-charcoal-500 text-xs whitespace-nowrap">
                    {new Date(e.timestamp).toLocaleString(undefined, {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

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
