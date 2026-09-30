import { Link } from 'react-router-dom'
import { Activity, ArrowRight, Shield, GitMerge, FileText } from 'lucide-react'

export function LandingPage() {
  return (
    <div className="min-h-screen bg-ivory-50 flex flex-col">
      {/* Nav */}
      <header className="px-8 py-6 flex items-center justify-between max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-teal-700 flex items-center justify-center">
            <Activity size={16} className="text-white" strokeWidth={2} />
          </div>
          <span className="font-serif text-lg text-charcoal-900 tracking-tight">MedBridge</span>
        </div>
        <nav className="flex items-center gap-6">
          <Link
            to="/hospital/login"
            className="text-sm text-charcoal-600 hover:text-teal-700 transition-colors duration-150"
          >
            Hospital Access
          </Link>
          <Link
            to="/admin/login"
            className="text-sm text-charcoal-500 hover:text-charcoal-800 transition-colors duration-150"
          >
            Administrator
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-24 pt-12">
        <div className="text-center max-w-2xl mx-auto animate-fade-in">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-50 border border-teal-200 mb-8">
            <div className="w-1.5 h-1.5 rounded-full bg-teal-500" />
            <span className="text-xs font-medium text-teal-700 tracking-wide">Emergency Identity Resolution</span>
          </div>

          {/* Title */}
          <h1 className="text-5xl font-serif text-charcoal-950 leading-tight tracking-tight mb-6">
            Clinical care that never<br />
            <em className="not-italic text-teal-700">waits on identity</em>
          </h1>

          {/* Subtitle */}
          <p className="text-lg text-charcoal-500 leading-relaxed mb-12 max-w-xl mx-auto">
            MedBridge creates a medical record in seconds for any arriving patient,
            then works quietly in parallel to resolve identity through a graduated,
            auditable fallback ladder — biometrics, physical evidence, network lookup, DNA.
          </p>

          {/* Entry points */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/hospital/login"
              className="group flex items-center justify-center gap-3 bg-teal-700 text-white px-7 py-3.5
                         rounded-xl font-medium text-sm hover:bg-teal-800 transition-all duration-150
                         shadow-medium hover:shadow-strong"
            >
              Hospital Access
              <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform duration-150" />
            </Link>
            <Link
              to="/admin/login"
              className="flex items-center justify-center gap-3 bg-white text-charcoal-700 px-7 py-3.5
                         rounded-xl font-medium text-sm border border-ivory-300 hover:border-charcoal-300
                         hover:bg-ivory-50 transition-all duration-150 shadow-soft"
            >
              Administrator
            </Link>
          </div>
        </div>

        {/* Feature strip */}
        <div className="mt-24 grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-3xl w-full mx-auto animate-slide-up">
          {[
            {
              icon: GitMerge,
              title: 'Graduated fallback',
              body: 'Six-tier identification ladder — biometrics first, DNA confirmatory. Any tier resolves the case.',
            },
            {
              icon: Shield,
              title: 'Immutable audit trail',
              body: 'Every attempt, confidence score and merge decision is written once and never deleted.',
            },
            {
              icon: FileText,
              title: 'Zero clinical delay',
              body: 'Temporary records accept vitals, injuries and treatment notes from the first second.',
            },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="bg-white rounded-2xl border border-ivory-200 shadow-soft p-6">
              <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center mb-4">
                <Icon size={17} className="text-teal-700" strokeWidth={1.75} />
              </div>
              <h3 className="text-sm font-serif text-charcoal-900 mb-1.5">{title}</h3>
              <p className="text-xs text-charcoal-500 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-7 text-center border-t border-ivory-200">
        <p className="text-xs text-charcoal-400 font-sans">
          MedBridge — Emergency Identity Resolution Platform &nbsp;·&nbsp;
          Biometric and DNA matching is simulated. Not for clinical deployment without institutional review.
        </p>
      </footer>
    </div>
  )
}
