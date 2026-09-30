import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Clock, UserSearch, ArrowRight, GitMerge, UserPlus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { TemporaryRecord } from '../../types/database'
import { PageHeader } from '../../components/ui/PageHeader'
import { EmptyState } from '../../components/ui/EmptyState'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Spinner } from '../../components/ui/Spinner'

function elapsed(admissionTime: string): string {
  const ms  = Date.now() - new Date(admissionTime).getTime()
  const min = Math.floor(ms / 60000)
  if (min < 60) return `${min}m`
  const hrs = Math.floor(min / 60)
  if (hrs < 24) return `${hrs}h ${min % 60}m`
  return `${Math.floor(hrs / 24)}d`
}

const tierLabel = ['Biometric', 'Physical evidence', 'Network lookup', 'Human recognition', 'DNA / STR', 'Manual review']

export function HospitalDashboard() {
  const { profile } = useAuth()
  const [openCases,   setOpenCases]   = useState<TemporaryRecord[]>([])
  const [recentMerges, setRecentMerges] = useState<number>(0)
  const [loading,      setLoading]     = useState(true)

  const load = useCallback(async () => {
    if (!profile?.hospital_id) return
    setLoading(true)

    const [{ data: cases }, { count: merges }] = await Promise.all([
      supabase
        .from('temporary_records')
        .select('*')
        .eq('hospital_id', profile.hospital_id)
        .eq('status', 'open')
        .order('admission_time', { ascending: false })
        .limit(20),
      supabase
        .from('merge_events')
        .select('id', { count: 'exact', head: true })
        .eq('hospital_id', profile.hospital_id),
    ])

    setOpenCases(cases ?? [])
    setRecentMerges(merges ?? 0)
    setLoading(false)
  }, [profile?.hospital_id])

  useEffect(() => { load() }, [load])

  // Realtime subscription for new temp records
  useEffect(() => {
    if (!profile?.hospital_id) return
    const channel = supabase
      .channel('dashboard-open-cases')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'temporary_records', filter: `hospital_id=eq.${profile.hospital_id}` },
        () => load()
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'temporary_records', filter: `hospital_id=eq.${profile.hospital_id}` },
        () => load()
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [profile?.hospital_id, load])

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Dashboard"
        subtitle="Open unidentified cases and recent activity."
        action={
          <div className="flex gap-3">
            <Link to="/hospital/enroll" className="btn-secondary flex items-center gap-2 text-sm">
              <UserPlus size={15} /> Enroll patient
            </Link>
            <Link to="/hospital/register" className="btn-primary flex items-center gap-2 text-sm">
              <UserSearch size={15} /> Register unidentified
            </Link>
          </div>
        }
      />

      {/* Stat strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        <div className="card flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center">
            <Clock size={18} className="text-teal-700" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-xs text-charcoal-500 uppercase tracking-wide">Open cases</p>
            {loading
              ? <div className="h-6 w-8 bg-charcoal-100 rounded animate-pulse mt-1" />
              : <p className="text-2xl font-serif text-charcoal-950">{openCases.length}</p>
            }
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-sage-50 border border-sage-100 flex items-center justify-center">
            <GitMerge size={18} className="text-sage-600" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-xs text-charcoal-500 uppercase tracking-wide">Total merges</p>
            {loading
              ? <div className="h-6 w-8 bg-charcoal-100 rounded animate-pulse mt-1" />
              : <p className="text-2xl font-serif text-charcoal-950">{recentMerges}</p>
            }
          </div>
        </div>
      </div>

      {/* Open cases table */}
      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-5 border-b border-ivory-200">
          <h2 className="section-title">Open unidentified cases</h2>
          <p className="text-xs text-charcoal-400 mt-0.5">
            All cases awaiting identity resolution, sorted by admission time.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : openCases.length === 0 ? (
          <EmptyState
            icon={UserSearch}
            title="No open cases"
            description="No unidentified patients are currently awaiting identification. New cases will appear here when registered."
            action={
              <Link to="/hospital/register" className="btn-primary flex items-center gap-2 text-sm">
                <UserSearch size={15} /> Register unidentified patient
              </Link>
            }
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ivory-200 bg-ivory-50">
                {['MRN', 'Placeholder', 'Admission', 'Elapsed', 'Current tier', 'Status', ''].map(col => (
                  <th key={col} className="text-left px-5 py-3.5 text-xs font-medium text-charcoal-500 uppercase tracking-wide">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ivory-100">
              {openCases.map(rec => (
                <tr key={rec.id} className="hover:bg-ivory-50 transition-colors duration-100 group">
                  <td className="px-5 py-4">
                    <span className="font-mono text-xs text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-100">
                      {rec.mrn}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-medium text-charcoal-900">{rec.placeholder_name}</p>
                    {rec.approx_sex && (
                      <p className="text-xs text-charcoal-400 mt-0.5">
                        {rec.approx_sex}{rec.approx_age ? ` · ~${rec.approx_age}y` : ''}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-4 text-charcoal-600 text-xs">
                    {new Date(rec.admission_time).toLocaleString(undefined, {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-sm font-medium text-charcoal-700 tabular-nums">
                      {elapsed(rec.admission_time)}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-xs text-charcoal-600">
                      Tier {rec.current_tier} · {tierLabel[rec.current_tier]}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={rec.status} />
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      to={`/hospital/identify/${rec.id}`}
                      className="text-xs font-medium text-teal-700 flex items-center gap-1 justify-end
                                 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                    >
                      Identify <ArrowRight size={12} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
