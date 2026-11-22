import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  failed: boolean;
}

/* A render error in one view should not leave the team with a blank page; the
   boundary offers a reload instead. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Cairo Art UI error", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <div className="grid min-h-screen place-items-center bg-bone px-4">
        <div className="w-full max-w-sm rounded-lg border border-line bg-card p-6 text-center">
          <div className="font-display text-[18px] text-ink">Something went wrong</div>
          <p className="mt-2 text-[12px] leading-relaxed text-ink-3">
            The desk hit an unexpected error. Your saved conversations and orders are unaffected.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-ink px-3.5 py-2 text-[13px] font-medium text-bone hover:bg-ink-2"
          >
            Reload the desk
          </button>
        </div>
      </div>
    );
  }
}
