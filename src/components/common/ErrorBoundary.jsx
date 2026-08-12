import { Component } from 'react';
export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error('FlowBiz error:', error, info); }
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center bg-sand p-6">
        <div className="card max-w-sm w-full p-6 text-center space-y-4">
          <div className="text-4xl">⚠️</div>
          <h2 className="font-display text-lg font-bold text-ink-900">Something went wrong</h2>
          <p className="text-sm text-ink-500">{this.state.error?.message}</p>
          <button className="btn-primary w-full" onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = '/'; }}>
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }
}
