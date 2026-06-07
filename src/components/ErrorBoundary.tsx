import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  info: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log so it shows up in console / remote logs
    console.error("[ErrorBoundary] Uncaught error:", error, info);
    this.setState({ info });
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <main className="min-h-screen bg-background text-foreground p-4 flex items-start justify-center">
          <div className="max-w-xl w-full mt-12 space-y-4 rounded-xl border border-destructive/30 bg-destructive/5 p-5">
            <h1 className="text-lg font-bold text-destructive">Nastala chyba pri načítavaní stránky</h1>
            <p className="text-sm text-muted-foreground">
              Skúste obnoviť stránku. Ak chyba pretrváva, pošlite tento výpis vývojárovi:
            </p>
            <pre className="text-xs bg-background border border-border rounded-md p-3 overflow-auto max-h-64 whitespace-pre-wrap break-words">
              {this.state.error.message}
              {this.state.error.stack ? "\n\n" + this.state.error.stack : ""}
              {this.state.info?.componentStack ? "\n\nKomponent:\n" + this.state.info.componentStack : ""}
            </pre>
            <button
              type="button"
              onClick={this.handleReload}
              className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:opacity-90"
            >
              Obnoviť stránku
            </button>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
