"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { InnerHeader } from "../components/InnerHeader";
import { formatShamsiDate } from "../components/ShamsiDateField";
import { type ApiBooking, fetchBookingDetail, hasAuthenticatedSession } from "../lib/api";

const serviceStatusLabels: Record<string, string> = { requested: "در انتظار هماهنگی", confirmed: "تأییدشده", unavailable: "غیرقابل ارائه", completed: "انجام‌شده", cancelled: "لغوشده" };
const serviceTimeLabels: Record<string, string> = { breakfast: "صبحانه", lunch: "ناهار", dinner: "شام", morning: "صبح", afternoon: "بعدازظهر", evening: "عصر", flexible: "زمان منعطف" };

export default function BookingConfirmedPage() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code") ?? "";
  const [booking, setBooking] = useState<ApiBooking | null>(null);
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");

  useEffect(() => {
    if (!code || !hasAuthenticatedSession()) { setState("error"); return; }
    void fetchBookingDetail(code).then((row) => { if (row) { setBooking(row); setState("ready"); } else setState("error"); }).catch(() => setState("error"));
  }, [code]);

  if (state !== "ready" || !booking) return <main dir="rtl" className="inner-page confirmation-page"><InnerHeader /><section className="confirmation-body section-shell"><div className="account-empty"><span>!</span><h1>رسید رزرو در دسترس نیست</h1><p>{code ? "برای دیدن این رسید با همان حسابی که رزرو را ثبت کرده‌اید وارد شوید." : "پس از ثبت درخواست، کد رزرو شما در این صفحه نمایش داده می‌شود."}</p><a href={code ? `/login?next=${encodeURIComponent(`/booking-confirmed?code=${code}`)}` : "/villas"}>{code ? "ورود به حساب" : "مشاهده ویلاها"}</a></div></section></main>;

  const villa = booking.villa;
  const transfer = booking.payments.filter((payment) => payment.gateway === "card_to_card").sort((a, b) => b.id - a.id)[0];
  const paymentCopy = booking.status === "confirmed" ? "پرداخت شما تأیید شده و تاریخ‌های اقامت قطعی هستند." : transfer?.status === "pending" ? "رسید انتقال شما در حال بررسی تیم مالی است." : transfer?.status === "failed" ? "رسید انتقال نیاز به اصلاح دارد؛ از صفحه پرداخت یک رسید جدید ارسال کنید." : "برای نگه‌داری زمان اقامت، انتقال کارت‌به‌کارت و ارسال رسید را انجام دهید.";
  return <main dir="rtl" className="inner-page confirmation-page"><InnerHeader />
    <section className="confirmation-hero"><div className="confirmation-art"><span className="success-ring"><i>✓</i></span><b>V1</b><i className="orbit orbit-one" /><i className="orbit orbit-two" /></div><div className="confirmation-copy"><p className="eyebrow"><span /> درخواست رزرو ثبت شد</p><h1>{booking.status === "confirmed" ? "رزرو شما\nقطعی شد." : "رزرو شما\nدر حال بررسی است."}</h1><p>{paymentCopy}</p><div className="confirmation-code"><span>کد رزرو</span><strong dir="ltr">{booking.code}</strong><button type="button" onClick={() => navigator.clipboard?.writeText(booking.code)}>کپی</button></div></div></section>
    <section className="confirmation-body section-shell"><article className="confirmed-stay"><img src={villa.cover_image || villa.images?.[0]?.url || ""} alt={villa.title} /><div className="confirmed-stay-copy"><span>اقامت در انتظار تأیید</span><h2>{villa.title}</h2><p>{villa.city.name} · {villa.setting_tags?.[0] || "اقامتگاه منتخب"}</p><div><b>{formatShamsiDate(booking.checkin)}</b><i>← اقامت →</i><b>{formatShamsiDate(booking.checkout)}</b></div></div><a href={`/villas/${villa.slug}`}>مشاهده ویلا ←</a></article>
      {booking.service_items.length > 0 && <section className="confirmation-addons"><h2>خدمات انتخابی سفر</h2><div>{booking.service_items.map((item) => <span key={item.slug}><b>{item.title}</b><small>{item.service_date ? `${formatShamsiDate(item.service_date)}${item.time_slot ? ` · ${serviceTimeLabels[item.time_slot] ?? item.time_slot}` : ""}` : serviceStatusLabels[item.status] ?? item.status}</small><small>{item.quantity.toLocaleString("fa-IR")} {item.unit_label || "واحد"} · {Number(item.total_price).toLocaleString("fa-IR")} تومان</small></span>)}</div></section>}
      <div className="confirmation-grid"><article><span>۰۱</span><h3>تماس کانسیرج</h3><p>تیم ما درخواست و جزئیات پرداخت را در بازه نگه‌داری رزرو با شما هماهنگ می‌کند.</p><small className="status-waiting">● در انتظار تماس</small></article><article><span>۰۲</span><h3>تأیید رزرو</h3><p>پس از ثبت پرداخت دستی و تأیید تیم، اطلاعات ورود از داخل رسید قابل مشاهده خواهد بود.</p><small>وضعیت فعلی: {booking.status}</small></article><article><span>۰۳</span><h3>رسید و پیگیری</h3><p>مبلغ، خدمات انتخابی و وضعیت اقامت در پنل شما به‌روز می‌شود.</p><a href={`/account/bookings/${encodeURIComponent(booking.code)}`}>مشاهده رسید ←</a></article></div>
      <div className="confirmation-actions">{booking.status === "pending_owner" && transfer?.status !== "pending" && <a className="primary-confirmation-action" href={`/payment?code=${encodeURIComponent(booking.code)}`}>ارسال رسید کارت‌به‌کارت</a>}<a className={booking.status !== "pending_owner" || transfer?.status === "pending" ? "primary-confirmation-action" : ""} href={`/account/bookings/${encodeURIComponent(booking.code)}`}>مشاهده فاکتور و رسید</a><a href="/account">رفتن به حساب من</a></div></section>
  </main>;
}
