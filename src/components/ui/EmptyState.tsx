import { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-2xl bg-ivory-100 border border-ivory-200 flex items-center justify-center mb-5">
        <Icon size={24} className="text-charcoal-400" strokeWidth={1.5} />
      </div>
      <h3 className="text-base font-serif text-charcoal-800 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-charcoal-500 max-w-xs leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
