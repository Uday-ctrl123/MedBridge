interface ConfidenceBarProps {
  score: number  // 0–1
  showLabel?: boolean
}

export function ConfidenceBar({ score, showLabel = true }: ConfidenceBarProps) {
  const pct = Math.round(score * 100)
  const color = score >= 0.90 ? 'bg-teal-600' : score >= 0.70 ? 'bg-sage-500' : 'bg-charcoal-400'
  const label = score >= 0.90 ? 'High confidence' : score >= 0.70 ? 'Moderate confidence' : 'Low confidence'

  return (
    <div className="space-y-1.5">
      {showLabel && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-charcoal-500">{label}</span>
          <span className="text-xs font-medium text-charcoal-700 tabular-nums">{pct}%</span>
        </div>
      )}
      <div className="h-1.5 bg-charcoal-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  )
}
