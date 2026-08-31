"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { InnerHeader } from "../components/InnerHeader";
import { formatShamsiDate } from "../components/ShamsiDateField";
import { type ApiBooking, fetchBookingDetail, hasAuthenticatedSession } from "../lib/api";
import styles from "./Confirmation.module.css";

const serviceStatusLabels: Record<string, string> = { requested: "در انتظار هماهنگی", confirmed: "تأییدشده", unavailable: "غیرقابل ارائه", completed: "انجام‌شده", cancelled: "لغوشده" };
const serviceTimeLabels: Record<string, string> = { breakfast: "صبحانه", lunch: "ناهار", dinner: "شام", morning: "صبح", afternoon: "بعدازظهر", evening: "عصر", flexible: "زمان منعطف" };
const bookingStatusLabels: Record<ApiBooking["status"], string> = { pending_owner: "در انتظار تأیید", confirmed: "رزرو تأیید شد", cancelled: "رزرو لغو شد", completed: "اقامت تکمیل شد", expired: "مهلت پرداخت تمام شد" };

export default function BookingConfirmedPage() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code") ?? "";
  const [booking, setBooking] = useState<ApiBooking | null>(null);
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");

  useEffect(() => {
    if (!code || !hasAuthenticatedSession()) { setState("error"); return; }
    void fetchBookingDetail(code).then((row) => { if (row) { setBooking(row); setState("ready"); } else setState("error"); }).catch(() => setState("error"));
  }, [code]);

  if (state !== "ready" || !booking) return <main dir="rtl" className={`${styles.page} inner-page confirmation-page`}><InnerHeader /><section className="confirmation-body section-shell"><div className="account-empty"><span>!</span><h1>رسید رزرو در دسترس نیست</h1><p>{code ? "برای دیدن این رسید با همان حسابی که رزرو را ثبت کرده‌اید وارد شوید." : "پس از ثبت درخواست، کد رزرو شما در این صفحه نمایش داده می‌شود."}</p><Link href={code ? `/login?next=${encodeURIComponent(`/booking-confirmed?code=${code}`)}` : "/villas"}>{code ? "ورود به حساب" : "مشاهده ویلاها"}</Link></div></section></main>;

  const villa = booking.villa;
  const transfer = booking.payments.filter((payment) => payment.gateway === "card_to_card").sort((a, b) => b.id - a.id)[0];
  const paymentCopy = booking.status === "confirmed" ? "پرداخت شما تأیید شده و تاریخ‌های اقامت قطعی هستند." : transfer?.status === "pending" ? "رسید انتقال شما در حال بررسی تیم مالی است." : transfer?.status === "failed" ? "رسید انتقال نیاز به اصلاح دارد؛ از صفحه پرداخت یک رسید جدید ارسال کنید." : "برای نگه‌داری زمان اقامت، انتقال کارت‌به‌کارت و ارسال رسید را انجام دهید.";
  const villaImage = villa.cover_image || villa.images?.[0]?.url;
  const transferStatus = booking.status === "confirmed" ? "پرداخت تأیید شد" : transfer?.status === "pending" ? "در حال بررسی" : transfer?.status === "failed" ? "نیازمند اصلاح" : "در انتظار ارسال رسید";
  return <main dir="rtl" className={`${styles.page} inner-page confirmation-page`}>
    <InnerHeader />
    <section className="confirmation-hero"><div className="confirmation-art"><span className="success-ring"><i>✓</i></span><b>V1</b><i className="orbit orbit-one" /><i className="orbit orbit-two" /></div><div className="confirmation-copy"><p className="eyebrow"><span /> درخواست رزرو ثبت شد</p><h1>{booking.status === "confirmed" ? "رزرو شما\nقطعی شد." : "رزرو شما\nدر حال بررسی است."}</h1><p>{paymentCopy}</p><div className="confirmation-code"><span>کد رزرو</span><strong dir="ltr">{booking.code}</strong><button type="button" onClick={() => navigator.clipboard?.writeText(booking.code)}>کپی</button></div></div></section>
    <section className="confirmation-body section-shell"><article className="confirmed-stay">{villaImage ? <img src={villaImage} alt={villa.title} /> : <div className="confirmed-stay-placeholder" aria-hidden="true">V1</div>}<div className="confirmed-stay-copy"><span>{booking.status === "confirmed" ? "اقامت قطعی‌شده" : booking.status === "expired" ? "مهلت اقامت منقضی‌شده" : "اقامت در انتظار تأیید"}</span><h2>{villa.title}</h2><p>{villa.city.name} · {villa.setting_tags?.[0] || "اقامتگاه منتخب"}</p><div><b>{formatShamsiDate(booking.checkin)}</b><i>← اقامت →</i><b>{formatShamsiDate(booking.checkout)}</b></div></div><Link href={`/villas/${villa.slug}`}>مشاهده ویلا ←</Link></article>
      {booking.service_items.length > 0 && <section className="confirmation-addons"><h2>خدمات انتخابی سفر</h2><div>{booking.service_items.map((item) => <span key={item.slug}><b>{item.title}</b><small>{item.service_date ? `${formatShamsiDate(item.service_date)}${item.time_slot ? ` · ${serviceTimeLabels[item.time_slot] ?? item.time_slot}` : ""}` : serviceStatusLabels[item.status] ?? item.status}</small><small>{item.quantity.toLocaleString("fa-IR")} {item.unit_label || "واحد"} · {Number(item.total_price).toLocaleString("fa-IR")} تومان</small></span>)}</div></section>}
      <div className="confirmation-grid"><article><span>۰۱</span><h3>پرداخت کارت‌به‌کارت</h3><p>رسید شما از طریق مسیر امن برای بررسی تیم مالی ارسال می‌شود.</p><small className="status-waiting">● {transferStatus}</small></article><article><span>۰۲</span><h3>تأیید رزرو</h3><p>پس از تطبیق پرداخت، رزرو قطعی و تاریخ‌های اقامت از دسترس دیگران خارج می‌شود.</p><small>وضعیت فعلی: {bookingStatusLabels[booking.status]}</small></article><article><span>۰۳</span><h3>رسید و پیگیری</h3><p>مبلغ، خدمات انتخابی و وضعیت اقامت در پنل شما به‌روز می‌شود.</p><Link href={`/account/bookings/${encodeURIComponent(booking.code)}`}>مشاهده رسید ←</Link></article></div>
      <div className="confirmation-actions">{booking.status === "pending_owner" && transfer?.status !== "pending" && <Link className="primary-confirmation-action" href={`/payment?code=${encodeURIComponent(booking.code)}`}>ارسال رسید کارت‌به‌کارت</Link>}<Link className={booking.status !== "pending_owner" || transfer?.status === "pending" ? "primary-confirmation-action" : ""} href={`/account/bookings/${encodeURIComponent(booking.code)}`}>مشاهده فاکتور و رسید</Link><Link href="/account">رفتن به حساب من</Link></div></section>
  </main>;
}
