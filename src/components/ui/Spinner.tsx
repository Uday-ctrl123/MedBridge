interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  const sizeClass = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-8 h-8' : 'w-6 h-6'
  return (
    <div
      className={`${sizeClass} border-2 border-teal-200 border-t-teal-600 rounded-full animate-spin ${className}`}
      role="status"
      aria-label="Loading"
    />
  )
}
