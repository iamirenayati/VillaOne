"use client";

export default function ArticleError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main dir="rtl" className="inner-page article-page"><section className="journal-state section-shell" role="alert"><strong>مقاله بارگذاری نشد.</strong><p>ارتباط با سرور برقرار نشد. دوباره تلاش کنید.</p><button type="button" onClick={reset}>تلاش دوباره</button></section></main>;
}
