'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

export interface AiAgentErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface AiAgentErrorBoundaryState {
  failed: boolean;
}

/**
 * The assistant must never take a page down. A render failure inside the
 * widget disappears quietly; the rest of the localized layout keeps working.
 */
export class AiAgentErrorBoundary extends Component<
  AiAgentErrorBoundaryProps,
  AiAgentErrorBoundaryState
> {
  state: AiAgentErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): AiAgentErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Intentionally no UI copy here: the boundary lives above the widget and
    // has no reliable way to know whether its own catalog/provider is intact.
  }

  render(): ReactNode {
    if (this.state.failed) return this.props.fallback ?? null;
    return this.props.children;
  }
}
