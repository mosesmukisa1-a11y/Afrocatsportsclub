import React from "react";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const payload = {
      message: error.message,
      stack: error.stack || "",
      componentStack: errorInfo.componentStack || "",
      route: window.location.pathname,
    };
    try {
      fetch("/api/log/client-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => {});
    } catch (_) {}
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          data-testid="error-boundary-fallback"
          className="min-h-screen flex items-center justify-center bg-[#1a1a2e] text-white p-6"
        >
          <div className="max-w-md w-full text-center space-y-6">
            <div className="text-5xl">⚠️</div>
            <h1 className="text-2xl font-bold" data-testid="text-error-title">
              Something went wrong
            </h1>
            <p className="text-gray-400" data-testid="text-error-message">
              An unexpected error occurred. Please try reloading the page.
            </p>
            {this.state.error && (
              <pre
                className="text-xs text-left bg-black/30 rounded p-3 overflow-auto max-h-40 text-red-400"
                data-testid="text-error-details"
              >
                {this.state.error.message}
              </pre>
            )}
            <button
              data-testid="button-reload"
              onClick={this.handleReload}
              className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg transition-colors"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
