import { InnerHeader } from "../components/InnerHeader";

export default function Loading() {
  return <main dir="rtl" className="inner-page journal-page"><InnerHeader /><section className="journal-heading section-shell"><div className="journal-skeleton journal-skeleton-heading" /><div className="journal-skeleton journal-skeleton-copy" /></section><section className="journal-grid section-shell" aria-busy="true" aria-label="در حال بارگذاری مجله"><div className="journal-skeleton journal-skeleton-card" /><div className="journal-skeleton journal-skeleton-card" /></section></main>;
}
