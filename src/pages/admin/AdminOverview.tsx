import { useEffect, useState } from 'react'
import { Building2, Activity, Search } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../components/ui/PageHeader'
import { Spinner } from '../../components/ui/Spinner'

interface Stats {
  totalHospitals: number
  activeHospitals: number
  totalSearches: number
}

function StatCard({ icon: Icon, label, value, loading }: {
  icon: React.ElementType; label: string; value: number; loading: boolean
}) {
  return (
    <div className="card flex items-start gap-5">
      <div className="w-11 h-11 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center flex-shrink-0">
        <Icon size={20} className="text-teal-700" strokeWidth={1.75} />
      </div>
      <div>
        <p className="text-xs font-medium text-charcoal-500 uppercase tracking-wide mb-1">{label}</p>
        {loading ? (
          <div className="h-7 w-12 bg-charcoal-100 rounded animate-pulse" />
        ) : (
          <p className="text-3xl font-serif text-charcoal-950 tabular-nums">{value.toLocaleString()}</p>
        )}
      </div>
    </div>
  )
}

export function AdminOverview() {
  const [stats,   setStats]   = useState<Stats>({ totalHospitals: 0, activeHospitals: 0, totalSearches: 0 })
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [
          { count: total },
          { count: active },
          { count: searches },
        ] = await Promise.all([
          supabase.from('hospitals').select('id', { count: 'exact', head: true }),
          supabase.from('hospitals').select('id', { count: 'exact', head: true }).eq('status', 'active'),
          supabase.from('identification_attempts').select('id', { count: 'exact', head: true }),
        ])
        setStats({
          totalHospitals:  total  ?? 0,
          activeHospitals: active ?? 0,
          totalSearches:   searches ?? 0,
        })
      } catch {
        setError('Could not load statistics.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Platform Overview"
        subtitle="Live counts from the database — no cached figures."
      />

      {error && (
        <div className="mb-6 px-4 py-3 rounded-xl bg-ivory-100 border border-ivory-300 text-sm text-charcoal-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-10">
        <StatCard icon={Building2} label="Total hospitals"  value={stats.totalHospitals}  loading={loading} />
        <StatCard icon={Activity}  label="Active hospitals" value={stats.activeHospitals} loading={loading} />
        <StatCard icon={Search}    label="Identity searches" value={stats.totalSearches} loading={loading} />
      </div>

      {/* Recent audit events */}
      <RecentAuditEvents />
    </div>
  )
}

function RecentAuditEvents() {
  const [events,  setEvents]  = useState<Array<{ id: string; event_type: string; timestamp: string; record_ref: string | null }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('audit_log')
      .select('id, event_type, timestamp, record_ref')
      .order('timestamp', { ascending: false })
      .limit(8)
      .then(({ data }) => {
        setEvents(data ?? [])
        setLoading(false)
      })
  }, [])

  const typeLabel: Record<string, string> = {
    hospital_created:      'Hospital added',
    hospital_deactivated:  'Hospital deactivated',
    identification_attempted: 'ID attempted',
    record_merged:         'Record merged',
    admin_signin:          'Admin sign-in',
  }

  return (
    <div className="card">
      <h2 className="section-title mb-5">Recent platform events</h2>
      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : events.length === 0 ? (
        <p className="text-sm text-charcoal-400 py-8 text-center">No events recorded yet.</p>
      ) : (
        <div className="divide-y divide-ivory-100">
          {events.map(ev => (
            <div key={ev.id} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-teal-400 flex-shrink-0" />
                <span className="text-sm text-charcoal-800">{typeLabel[ev.event_type] ?? ev.event_type}</span>
                {ev.record_ref && (
                  <span className="text-xs text-charcoal-400 font-mono">{ev.record_ref.slice(0, 8)}</span>
                )}
              </div>
              <time className="text-xs text-charcoal-400 flex-shrink-0">
                {new Date(ev.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </time>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
