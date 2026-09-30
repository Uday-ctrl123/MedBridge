import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in React component tree:', error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-ivory-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-2xl border border-ivory-200 p-8 shadow-medium text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto text-xl font-bold">
              !
            </div>
            <h2 className="text-xl font-serif text-charcoal-950">Application Error</h2>
            <p className="text-sm text-charcoal-600 leading-relaxed">
              An unexpected error occurred while rendering the page.
            </p>
            {this.state.error?.message && (
              <div className="p-3 bg-ivory-100 rounded-xl text-left border border-ivory-200 text-xs text-charcoal-700 font-mono overflow-auto max-h-32">
                {this.state.error.message}
              </div>
            )}
            <div className="pt-2 flex gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="btn-primary"
              >
                Reload Page
              </button>
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null })
                  window.location.href = '/'
                }}
                className="btn-secondary"
              >
                Go to Home
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
