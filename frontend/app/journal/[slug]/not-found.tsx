import { InnerHeader } from "../../components/InnerHeader";

export default function NotFound() {
  return <main dir="rtl" className="inner-page article-page"><InnerHeader /><section className="journal-state section-shell"><strong>این مقاله پیدا نشد.</strong><p>ممکن است مقاله آرشیو شده باشد یا نشانی آن تغییر کرده باشد.</p><a href="/journal">بازگشت به مجله</a></section></main>;
}
