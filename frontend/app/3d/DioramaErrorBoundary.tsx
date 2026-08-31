"use client";

import { Component, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  resetKey: number;
  onError: () => void;
};

type State = { failed: boolean };

export class DioramaErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  componentDidUpdate(previous: Props) {
    if (previous.resetKey !== this.props.resetKey && this.state.failed) {
      this.setState({ failed: false });
    }
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
