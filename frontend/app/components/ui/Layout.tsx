import type { HTMLAttributes, ReactNode } from "react";
import styles from "./Layout.module.css";

export function PageContainer({ className = "", children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={`${styles.container} ${className}`.trim()}>{children}</div>;
}

export function Section({ className = "", children, ...props }: HTMLAttributes<HTMLElement>) {
  return <section {...props} className={`${styles.section} ${className}`.trim()}>{children}</section>;
}

export function PageIntro({ eyebrow, title, description, actions, className = "" }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode; className?: string }) {
  return (
    <header className={`${styles.intro} ${className}`.trim()}>
      {eyebrow && <p className={styles.eyebrow}><span aria-hidden="true" />{eyebrow}</p>}
      <h1>{title}</h1>
      {description && <p className={styles.description}>{description}</p>}
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}

export function SectionHeading({ eyebrow, title, description, actions, className = "" }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode; className?: string }) {
  return (
    <div className={`${styles.heading} ${className}`.trim()}>
      <div>
        {eyebrow && <p className={styles.eyebrow}><span aria-hidden="true" />{eyebrow}</p>}
        <h2>{title}</h2>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}

export function Surface({ className = "", children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={`${styles.surface} ${className}`.trim()}>{children}</div>;
}
