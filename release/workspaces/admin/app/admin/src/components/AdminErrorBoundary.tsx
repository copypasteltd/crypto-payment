import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { notifyUnexpectedError } from "../lib/toast";
import i18n from "../i18n";

export class AdminErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    notifyUnexpectedError(error, info.componentStack ? i18n.t("common:toast.renderError") : i18n.t("common:toast.pageError"));
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="fatal-error admin-boundary-error" role="alert">
        <AlertTriangle size={30} />
        <h1>{i18n.t("common:toast.pageError")}</h1>
        <p>{this.state.error.message}</p>
        <button type="button" className="button primary" onClick={() => window.location.reload()}><RefreshCw size={17} />{i18n.t("common:toast.reload")}</button>
      </main>
    );
  }
}
