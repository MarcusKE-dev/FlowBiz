import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';
import { appPath } from '../../lib/appUrl';

export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error('FlowBiz error:', error, info); }
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
        <div className="w-full max-w-sm space-y-3 rounded-panel border border-line bg-surface p-6 text-center">
          <AlertTriangle
            className="mx-auto h-5 w-5 text-danger-600"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <h2 className="font-display text-page-title text-ink-900">Something went wrong</h2>
          <p className="text-body text-ink-600">
            {this.state.error?.message || 'FlowBiz could not finish loading this screen.'}
          </p>
          <button
            className="btn-primary w-full"
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = appPath('/'); }}
          >
            Return to dashboard
          </button>
        </div>
      </div>
    );
  }
}
