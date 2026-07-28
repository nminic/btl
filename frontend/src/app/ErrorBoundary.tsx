import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = {
  fallback: ReactNode
  children: ReactNode
}

type State = {
  failed: boolean
}

/* Without this, any thrown error unmounts the whole tree and the visitor gets
 * a blank white page with no explanation. A class is required: React has no
 * hook for this.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled error in the interface', error, info.componentStack)
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
