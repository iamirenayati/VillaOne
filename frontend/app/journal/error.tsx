"use client";

export default function JournalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main dir="rtl" className="inner-page journal-page"><section className="journal-state section-shell" role="alert"><strong>دریافت مجله ممکن نیست.</strong><p>ارتباط با سرور برقرار نشد. دوباره تلاش کنید.</p><button type="button" onClick={reset}>تلاش دوباره</button></section></main>;
}
