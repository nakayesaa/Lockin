import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  readonly children: ReactNode;
}

interface ErrorBoundaryState {
  readonly hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public override state: ErrorBoundaryState = { hasError: false };

  public static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  public override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Renderer failed safely', {
      name: error.name,
      message: error.message,
      componentStack: info.componentStack,
    });
  }

  public override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <main className="grid min-h-screen place-items-center bg-stone-100 p-8 text-stone-900">
          <section className="max-w-md text-center">
            <h1 className="text-2xl font-semibold">LockIn needs to restart</h1>
            <p className="mt-3 text-stone-600">
              The interface stopped unexpectedly. Close and reopen the app; your saved data is safe.
            </p>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
