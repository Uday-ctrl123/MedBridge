type Status = 'open' | 'merged' | 'active' | 'inactive' | 'enrolled' | 'pending' | 'matched' | 'no_match' | 'failed' | string

const variants: Record<string, string> = {
  open:     'bg-teal-50 text-teal-800 border-teal-200',
  merged:   'bg-sage-50 text-sage-700 border-sage-200',
  active:   'bg-teal-50 text-teal-800 border-teal-200',
  inactive: 'bg-charcoal-100 text-charcoal-600 border-charcoal-200',
  enrolled: 'bg-sage-50 text-sage-700 border-sage-200',
  pending:  'bg-ivory-100 text-charcoal-600 border-ivory-300',
  matched:  'bg-sage-50 text-sage-700 border-sage-200',
  no_match: 'bg-charcoal-100 text-charcoal-500 border-charcoal-200',
  failed:   'bg-charcoal-100 text-charcoal-500 border-charcoal-200',
}

const labels: Record<string, string> = {
  open:     'Open',
  merged:   'Merged',
  active:   'Active',
  inactive: 'Inactive',
  enrolled: 'Enrolled',
  pending:  'Pending',
  matched:  'Matched',
  no_match: 'No Match',
  failed:   'Failed',
}

interface StatusBadgeProps {
  status: Status
  className?: string
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const variant = variants[status] ?? 'bg-charcoal-100 text-charcoal-600 border-charcoal-200'
  const label   = labels[status] ?? status

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${variant} ${className}`}>
      {label}
    </span>
  )
}
