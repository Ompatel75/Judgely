import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '../ui/Button'

interface Props {
  children: ReactNode
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
    console.error('Uncaught error in Judgely frontend:', error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-surface border border-red-500/20 rounded-lg p-6 text-center">
            <div className="w-10 h-10 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h2 className="text-base font-semibold text-text-primary mb-1">
              Application Error
            </h2>
            <p className="text-xs text-text-secondary mb-4 font-mono">
              {this.state.error?.message || 'An unexpected rendering error occurred.'}
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                this.setState({ hasError: false, error: null })
                window.location.reload()
              }}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reload Page
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

