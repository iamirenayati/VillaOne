import type { ReactNode } from "react";
import { Button } from "./Button";
import styles from "./Feedback.module.css";

type StateProps = {
  title?: string;
  message: string;
  action?: ReactNode;
  className?: string;
};

export function LoadingState({ message, className = "" }: StateProps) {
  return (
    <div className={`${styles.state} ${styles.loading} ${className}`.trim()} role="status" aria-busy="true">
      <span className={styles.spinner} aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}

export function EmptyState({ title = "موردی برای نمایش نیست", message, action, className = "" }: StateProps) {
  return (
    <div className={`${styles.state} ${styles.empty} ${className}`.trim()} role="status">
      <span className={styles.mark} aria-hidden="true">—</span>
      <h2>{title}</h2>
      <p>{message}</p>
      {action}
    </div>
  );
}

type ErrorStateProps = StateProps & { onRetry?: () => void; retryLabel?: string };

export function ErrorState({ title = "ارتباط با سرور ناموفق بود", message, onRetry, retryLabel = "تلاش دوباره", action, className = "" }: ErrorStateProps) {
  return (
    <div className={`${styles.state} ${styles.error} ${className}`.trim()} role="alert">
      <span className={styles.mark} aria-hidden="true">!</span>
      <h2>{title}</h2>
      <p>{message}</p>
      {action ?? (onRetry ? <Button variant="secondary" size="sm" onClick={onRetry}>{retryLabel}</Button> : null)}
    </div>
  );
}

type NoticeTone = "info" | "success" | "warning" | "danger";

export function InlineNotice({ tone = "info", message, className = "" }: { tone?: NoticeTone; message: string; className?: string }) {
  return <p className={`${styles.notice} ${styles[tone]} ${className}`.trim()} role={tone === "danger" ? "alert" : "status"}>{message}</p>;
}

type StatusTone = "neutral" | NoticeTone;

const stateTone: Record<string, StatusTone> = {
  published: "success", confirmed: "success", paid: "success", approved: "success", available: "success",
  pending: "warning", pending_owner: "warning", pending_review: "warning", requested: "warning",
  failed: "danger", rejected: "danger", cancelled: "danger", expired: "danger", unavailable: "danger",
};

export function StatusBadge({ label, state, tone }: { label: string; state?: string; tone?: StatusTone }) {
  const resolvedTone = tone ?? stateTone[state ?? ""] ?? "neutral";
  return <span className={`${styles.badge} ${styles[resolvedTone]}`}><i aria-hidden="true" />{label}</span>;
}
