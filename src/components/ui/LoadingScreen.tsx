export function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-ivory-50 flex items-center justify-center z-50">
      <div className="text-center space-y-4">
        <div className="w-10 h-10 border-2 border-teal-200 border-t-teal-600 rounded-full animate-spin mx-auto" />
        <p className="text-sm text-charcoal-500 font-sans">Loading…</p>
      </div>
    </div>
  )
}
