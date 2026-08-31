"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { InnerHeader } from "../../../components/InnerHeader";
import { type ApiBooking, createBookingReview, fetchBookingDetail, hasAuthenticatedSession, VillaOneApiError } from "../../../lib/api";
import styles from "./Receipt.module.css";

const money = (value: string) => Number(value).toLocaleString("fa-IR");
const date = (value: string) => new Intl.DateTimeFormat("fa-IR-u-ca-persian", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${value}T12:00:00`));
const serviceStatusLabels: Record<string, string> = { requested: "در انتظار هماهنگی", confirmed: "تأییدشده", unavailable: "غیرقابل ارائه", completed: "انجام‌شده", cancelled: "لغوشده" };
const bookingStatusLabels: Record<string, string> = { pending_owner: "در انتظار تأیید", confirmed: "تأییدشده", completed: "اقامت تکمیل‌شده", cancelled: "لغوشده", expired: "مهلت پرداخت تمام‌شده" };

export default function BookingReceiptPage() {
  const params = useParams<{ code: string }>();
  const code = decodeURIComponent(params.code);
  const [booking, setBooking] = useState<ApiBooking | null>(null);
  const [error, setError] = useState("");
  const [rating, setRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [reviewMessage, setReviewMessage] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);

  async function submitReview() {
    if (!booking || reviewComment.trim().length < 10) { setReviewMessage("لطفاً تجربه‌تان را کمی کامل‌تر بنویسید."); return; }
    setReviewBusy(true);
    setReviewMessage("");
    try {
      const review = await createBookingReview(booking.code, { rating, title: reviewTitle, comment: reviewComment });
      if (review) setBooking({ ...booking, review });
      setReviewMessage("نظر شما ثبت شد و پس از بررسی منتشر می‌شود.");
    } catch (reason) {
      setReviewMessage(reason instanceof VillaOneApiError ? reason.message : "ثبت نظر انجام نشد؛ دوباره تلاش کنید.");
    } finally { setReviewBusy(false); }
  }

  useEffect(() => {
    if (!hasAuthenticatedSession()) { window.location.href = `/login?next=${encodeURIComponent(`/account/bookings/${code}`)}`; return; }
    void fetchBookingDetail(code).then((item) => { if (item) setBooking(item); }).catch((reason) => setError(reason instanceof Error ? reason.message : "رسید پیدا نشد."));
  }, [code]);

  return <main dir="rtl" className={`${styles.page} inner-page receipt-page`}><InnerHeader /><section className="receipt-shell section-shell">
    {error ? <div className="receipt-state"><h1>رسید در دسترس نیست</h1><p>{error}</p><Link href="/account">بازگشت به حساب</Link></div> : !booking ? <div className="receipt-state"><h1>در حال آماده‌سازی رسید…</h1></div> : <article className="receipt-paper">
      <header><div><span className="brand-mark"><i>V</i><b>1</b></span><div><strong>VILLAONE</strong><small>رسید رزرو ویلاوان</small></div></div><button type="button" onClick={() => window.print()}>چاپ / ذخیره PDF</button></header>
      <div className="receipt-title"><p>کد رزرو</p><h1 dir="ltr">{booking.code}</h1><span className={`receipt-status ${booking.status}`}>{bookingStatusLabels[booking.status] ?? "در انتظار تأیید"}</span></div>
      <section className="receipt-villa">{booking.villa.cover_image ? <img src={booking.villa.cover_image} alt={booking.villa.title} /> : <div className="receipt-villa-placeholder" aria-hidden="true">V1</div>}<div><small>{booking.villa.city.name} · مازندران</small><h2>{booking.villa.title}</h2><p>{date(booking.checkin)} تا {date(booking.checkout)} · {booking.guests_count.toLocaleString("fa-IR")} مهمان</p></div></section>
      <section className="receipt-finance"><h2>خلاصه مالی</h2><dl><div><dt>هزینه اقامت</dt><dd>{money(Number(booking.stay_total) > 0 ? booking.stay_total : booking.total_price)} تومان</dd></div>{Number(booking.services_total) > 0 && <div><dt>خدمات انتخابی</dt><dd>{money(booking.services_total)} تومان</dd></div>}<div><dt>مبلغ کل رزرو</dt><dd>{money(booking.total_price)} تومان</dd></div><div><dt>پرداخت ثبت‌شده</dt><dd>{money(booking.deposit_paid_online)} تومان</dd></div><div><dt>مانده قابل پرداخت</dt><dd>{money(booking.remaining_amount)} تومان</dd></div></dl></section>
      {booking.service_items.length > 0 && <section className="receipt-payments"><h2>خدمات انتخابی</h2>{booking.service_items.map((item) => <div key={item.slug}><span><b>{item.title}</b><small>{serviceStatusLabels[item.status] ?? item.status}</small></span><strong>{money(item.total_price)} تومان</strong><code>{item.quantity.toLocaleString("fa-IR")} عدد</code></div>)}</section>}
      <section className="receipt-payments"><h2>تراکنش‌ها</h2>{booking.payments.length ? booking.payments.map((payment) => <div key={payment.id}><span><b>{payment.status === "paid" ? "پرداخت تأییدشده" : payment.status === "failed" ? "رسید رد شده" : payment.status === "refunded" ? "وجه بازگردانده‌شده" : "رسید در انتظار بررسی"}</b><small>{payment.gateway === "card_to_card" ? "کارت به کارت" : payment.gateway === "manual" ? "ثبت دستی توسط تیم ویلاوان" : payment.gateway === "zarinpal" ? "زرین‌پال" : payment.gateway}{payment.review_note ? ` · ${payment.review_note}` : ""}</small></span><strong>{money(payment.amount)} تومان</strong><code dir="ltr">{payment.reference_id || payment.authority.slice(0, 18) || "—"}</code></div>) : <p>تراکنشی برای این رزرو ثبت نشده است.</p>}</section>
      {booking.status === "completed" && <section className="receipt-review"><h2>تجربه اقامت شما</h2>{booking.review ? <div className="review-submitted"><strong>{"★".repeat(booking.review.rating)}{"☆".repeat(5 - booking.review.rating)}</strong><p>{booking.review.comment}</p><small>{booking.review.status === "approved" ? "منتشرشده" : booking.review.status === "rejected" ? "منتشر نشد" : "در انتظار بررسی"}</small></div> : <div className="review-form"><div className="star-picker" aria-label="امتیاز اقامت">{[1, 2, 3, 4, 5].map((value) => <button type="button" key={value} onClick={() => setRating(value)} aria-label={`${value} ستاره`}>{value <= rating ? "★" : "☆"}</button>)}</div><input value={reviewTitle} onChange={(event) => setReviewTitle(event.target.value)} maxLength={120} placeholder="عنوان کوتاه (اختیاری)" /><textarea value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} rows={4} placeholder="درباره نظافت، امکانات و تجربه میزبانی بنویسید..." /><button type="button" disabled={reviewBusy} onClick={submitReview}>{reviewBusy ? "در حال ثبت..." : "ثبت نظر"}</button></div>}{reviewMessage && <p className="review-message">{reviewMessage}</p>}</section>}
      <footer><p>این رسید از حساب کاربری ویلاوان صادر شده است.</p><Link href="/account">بازگشت به رزروهای من</Link></footer>
    </article>}
  </section></main>;
}
