"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { InnerHeader } from "../components/InnerHeader";
import { PublicFooter } from "../components/PublicFooter";
import type { VillaListing } from "../types/villa";
import { type ApiBooking, type ApiUser, fetchCurrentUser, fetchFavoriteVillas, fetchMyBookings, hasAuthenticatedSession, requestBookingCancellation, signOut, toggleVillaFavorite, updateCurrentUser } from "../lib/api";
import styles from "./Account.module.css";

type AccountBooking = {
  slug: string; title: string; city: string; image: string; guests: string;
  paymentType: "deposit" | "full"; payable: number; total: number; paid: number;
  code: string; checkin: string; checkout: string; status: ApiBooking["status"];
  cancellationStatus: ApiBooking["cancellation_status"];
  cancellationQuote: ApiBooking["cancellation_quote"];
  refundAmount: number;
};

function mapBooking(item: ApiBooking): AccountBooking {
  return {
    slug: item.villa.slug,
    title: item.villa.title,
    city: item.villa.city.name,
    image: item.villa.cover_image || item.villa.images?.[0]?.url || "",
    guests: String(item.guests_count),
    paymentType: item.payment_plan,
    payable: Number(item.amount_due_now),
    total: Number(item.total_price),
    paid: Number(item.deposit_paid_online),
    code: item.code,
    checkin: item.checkin,
    checkout: item.checkout,
    status: item.status,
    cancellationStatus: item.cancellation_status,
    cancellationQuote: item.cancellation_quote,
    refundAmount: Number(item.refund_amount),
  };
}

const formatStayDate = (value: string) => new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${value}T12:00:00`));
const nightsOf = (booking: AccountBooking) => Math.max(1, Math.round((new Date(`${booking.checkout}T12:00:00`).getTime() - new Date(`${booking.checkin}T12:00:00`).getTime()) / 86400000));

export default function AccountPage() {
  const [ready, setReady] = useState(false);
  const [loadRevision, setLoadRevision] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState<ApiUser | null>(null);
  const [bookings, setBookings] = useState<AccountBooking[]>([]);
  const [favorites, setFavorites] = useState<VillaListing[]>([]);
  const [selectedCode, setSelectedCode] = useState("");
  const [view, setView] = useState<"bookings" | "favorites" | "profile">("bookings");
  const [profile, setProfile] = useState({ first_name: "", last_name: "", email: "", booking_sms_enabled: true, marketing_sms_enabled: false, email_notifications_enabled: false });
  const [profileMessage, setProfileMessage] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [showCancellation, setShowCancellation] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [cancellationMessage, setCancellationMessage] = useState("");
  const [cancellationPending, setCancellationPending] = useState(false);
  const selected = useMemo(() => bookings.find((booking) => booking.code === selectedCode) ?? bookings[0] ?? null, [bookings, selectedCode]);
  const guestName = user ? (`${user.first_name} ${user.last_name}`.trim() || user.phone) : "مهمان ویلاوان";

  useEffect(() => {
    let active = true;
    setLoadError("");
    setReady(false);
    if (!hasAuthenticatedSession()) { setReady(true); return; }
    setAuthenticated(true);
    void Promise.all([fetchCurrentUser(), fetchMyBookings(), fetchFavoriteVillas()]).then(([currentUser, items, savedVillas]) => {
      if (!active) return;
      if (currentUser) {
        setUser(currentUser);
        setProfile({ first_name: currentUser.first_name, last_name: currentUser.last_name, email: currentUser.email, booking_sms_enabled: currentUser.booking_sms_enabled, marketing_sms_enabled: currentUser.marketing_sms_enabled, email_notifications_enabled: currentUser.email_notifications_enabled });
      }
      const mapped = (items ?? []).map(mapBooking);
      setBookings(mapped);
      setFavorites(savedVillas ?? []);
      if (mapped[0]) setSelectedCode(mapped[0].code);
    }).catch((error) => { if (active) setLoadError(error instanceof Error ? error.message : "دریافت اطلاعات حساب انجام نشد."); }).finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, [loadRevision]);

  async function saveProfile() {
    setSavingProfile(true); setProfileMessage("");
    try {
      const updated = await updateCurrentUser(profile);
      if (updated) { setUser(updated); setProfileMessage("اطلاعات حساب با موفقیت ذخیره شد."); }
    } catch (error) { setProfileMessage(error instanceof Error ? error.message : "ذخیره اطلاعات انجام نشد."); }
    finally { setSavingProfile(false); }
  }

  async function submitCancellation() {
    if (!selected || cancellationReason.trim().length < 5) { setCancellationMessage("لطفاً دلیل لغو را کمی کامل‌تر بنویسید."); return; }
    setCancellationPending(true); setCancellationMessage("");
    try {
      const result = await requestBookingCancellation(selected.code, cancellationReason.trim());
      if (!result) throw new Error("برای ثبت درخواست دوباره وارد حساب شوید.");
      setBookings((items) => items.map((item) => item.code === selected.code ? { ...item, cancellationStatus: "requested" } : item));
      setShowCancellation(false); setCancellationMessage(`درخواست لغو ثبت شد. مبلغ برآوردی بازگشت وجه ${Number(result.estimated_refund_amount).toLocaleString("fa-IR")} تومان است.`);
    } catch (error) { setCancellationMessage(error instanceof Error ? error.message : "ثبت درخواست لغو انجام نشد."); }
    finally { setCancellationPending(false); }
  }

  async function removeFavorite(slug: string) {
    setFavorites((items) => items.filter((item) => item.slug !== slug));
    try { await toggleVillaFavorite(slug); }
    catch { const restored = await fetchFavoriteVillas().catch(() => null); if (restored) setFavorites(restored); }
  }

  if (!ready) return <main dir="rtl" className={`${styles.page} inner-page account-page`}><InnerHeader /><section className="account-access-state section-shell"><span className="status-pulse" /><h1>در حال آماده‌کردن حساب شما…</h1></section><PublicFooter /></main>;
  if (!authenticated) return <main dir="rtl" className={`${styles.page} inner-page account-page`}><InnerHeader /><section className="account-access-state section-shell"><span className="brand-mark"><i>V</i><b>1</b></span><h1>برای دیدن سفرها وارد شوید</h1><p>رزروها، پرداخت‌ها و درخواست‌های لغو فقط در حساب امن شما نمایش داده می‌شوند.</p><Link href="/login?next=/account">ورود با شماره موبایل</Link></section><PublicFooter /></main>;
  if (loadError) return <main dir="rtl" className={`${styles.page} inner-page account-page`}><InnerHeader /><section className="account-access-state section-shell"><span className="brand-mark"><i>!</i></span><h1>اطلاعات حساب دریافت نشد</h1><p>{loadError}</p><button type="button" onClick={() => setLoadRevision((value) => value + 1)}>تلاش دوباره</button></section><PublicFooter /></main>;

  const cancelled = selected && (selected.status === "cancelled" || selected.status === "expired" || selected.cancellationStatus === "approved" || selected.cancellationStatus === "refunded");
  const statusLabel = selected?.status === "expired" ? "مهلت پرداخت تمام شد" : cancelled ? "رزرو لغو شد" : selected?.cancellationStatus === "requested" ? "درخواست لغو در حال بررسی" : selected?.status === "confirmed" ? "رزرو تأیید شد" : "در انتظار تأیید میزبان";

  return <main dir="rtl" className={`${styles.page} inner-page account-page`}>
    <InnerHeader />
    <section className="account-shell section-shell">
      <aside className="account-sidebar">
        <div className="account-person"><span>{guestName.slice(0, 1)}</span><div><strong>{guestName}</strong><small>{user?.phone}</small></div></div>
        <nav aria-label="پنل کاربری"><button className={view === "bookings" ? "active" : ""} type="button" onClick={() => setView("bookings")}><i>▣</i>رزروهای من <span>{bookings.length.toLocaleString("fa-IR")}</span></button><button className={view === "favorites" ? "active" : ""} type="button" onClick={() => setView("favorites")}><i>♡</i>ذخیره‌شده‌ها <span>{favorites.length.toLocaleString("fa-IR")}</span></button><button className={view === "profile" ? "active" : ""} type="button" onClick={() => setView("profile")}><i>⚙</i>اطلاعات حساب</button><button type="button" onClick={() => { signOut(); window.location.href = "/"; }}><i>←</i>خروج از حساب</button></nav>
        <Link className="account-concierge" href="/#footer"><span>V1</span><p><b>کانسیرج شخصی</b>برای سفر پیش رو همراه شماست.</p><i>←</i></Link>
      </aside>
      <div className="account-main">
        <header className="account-heading"><div><p>سلام {guestName}، خوش آمدید</p><h1>{view === "profile" ? "اطلاعات حساب" : view === "favorites" ? "ویلاهای ذخیره‌شده" : "رزروهای من"}</h1></div><Link href="/villas">+ رزرو اقامتگاه جدید</Link></header>

        {view === "profile" ? <section className="profile-panel"><div><h2>مشخصات مهمان اصلی</h2><p>این اطلاعات برای رسید رزرو و هماهنگی ورود استفاده می‌شود.</p></div><div className="profile-grid"><label><span>نام</span><input value={profile.first_name} onChange={(event) => setProfile({ ...profile, first_name: event.target.value })} /></label><label><span>نام خانوادگی</span><input value={profile.last_name} onChange={(event) => setProfile({ ...profile, last_name: event.target.value })} /></label><label><span>شماره موبایل</span><input dir="ltr" value={user?.phone ?? ""} disabled /></label><label><span>ایمیل</span><input dir="ltr" type="email" value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} placeholder="name@example.com" /></label></div><button type="button" disabled={savingProfile} onClick={saveProfile}>{savingProfile ? "در حال ذخیره…" : "ذخیره تغییرات"}</button>{profileMessage && <p className="profile-message" role="status">{profileMessage}</p>}</section> : view === "favorites" ? <section className="saved-villas">{favorites.length ? favorites.map((villa) => <article key={villa.slug}><a href={`/villas/${villa.slug}`}>{villa.image ? <img src={villa.image} alt={villa.title} /> : <span className="saved-villa-placeholder" aria-hidden="true">V1</span>}</a><div><small>{villa.city} · {villa.setting}</small><h2><a href={`/villas/${villa.slug}`}>{villa.title}</a></h2><p><strong>{villa.priceLabel}</strong> تومان / شب</p><button type="button" onClick={() => removeFavorite(villa.slug)}>حذف از ذخیره‌شده‌ها</button></div></article>) : <div className="account-empty"><span>♡</span><h2>هنوز ویلایی ذخیره نکرده‌اید</h2><p>با لمس نشان قلب، انتخاب‌های دلخواهتان را برای مقایسه نگه دارید.</p><a href="/villas">کشف ویلاها</a></div>}</section> : bookings.length === 0 ? <section className="account-empty"><span>V1</span><h2>هنوز سفری ثبت نکرده‌اید</h2><p>مجموعه ویلاهای دست‌چین‌شده را ببینید و اولین اقامت خود را برنامه‌ریزی کنید.</p><a href="/villas">مشاهده ویلاها</a></section> : <>
          <section className="account-stats"><article><span>تعداد رزروها</span><strong>{bookings.length.toLocaleString("fa-IR")}</strong><small>همه سفرهای شما</small></article><article><span>شب‌های رزروشده</span><strong>{bookings.reduce((sum, item) => sum + nightsOf(item), 0).toLocaleString("fa-IR")}</strong><small>مجموع اقامت</small></article><article><span>مبلغ پرداخت‌شده</span><strong>{bookings.reduce((sum, item) => sum + item.paid, 0).toLocaleString("fa-IR")}</strong><small>تومان</small></article></section>
          {bookings.length > 1 && <div className="account-booking-tabs">{bookings.map((item) => <button className={item.code === selected?.code ? "active" : ""} type="button" key={item.code} onClick={() => { setSelectedCode(item.code); setShowCancellation(false); setCancellationMessage(""); }}><b>{item.title}</b><small dir="ltr">{item.code}</small></button>)}</div>}
          {selected && <section className="upcoming-section"><div className="account-section-title"><div><span className="status-pulse" /><h2>جزئیات رزرو</h2></div><small>آخرین وضعیت ثبت‌شده</small></div><article className="account-booking-card"><div className="account-booking-image">{selected.image ? <img src={selected.image} alt={selected.title} /> : <div className="account-booking-image-placeholder" aria-hidden="true">V1</div>}<span className={cancelled ? "cancelled" : selected.status === "confirmed" ? "confirmed" : ""}>{statusLabel}</span></div><div className="account-booking-content"><div className="account-booking-top"><div><small>{selected.city} · مازندران</small><h2>{selected.title}</h2><p>اقامتگاه تأییدشده ویلاوان</p></div><span><small>کد رزرو</small><b dir="ltr">{selected.code}</b></span></div><div className="account-trip-details"><div><span>ورود</span><b>{formatStayDate(selected.checkin)}</b><small>بعد از ساعت ۱۵</small></div><i>{nightsOf(selected).toLocaleString("fa-IR")} شب</i><div><span>خروج</span><b>{formatStayDate(selected.checkout)}</b><small>تا ساعت ۱۲</small></div><div><span>مهمانان</span><b>{Number(selected.guests).toLocaleString("fa-IR")} نفر</b><small>مهمان اصلی: {guestName}</small></div></div><div className="account-booking-footer"><div><span>پرداخت‌شده</span><strong>{selected.paid.toLocaleString("fa-IR")} تومان</strong><small>از مجموع {selected.total.toLocaleString("fa-IR")} تومان</small></div><div className="account-card-actions"><a href={`/account/bookings/${encodeURIComponent(selected.code)}`}>رسید و جزئیات</a>{cancelled ? <button disabled>رزرو لغوشده</button> : selected.cancellationStatus === "requested" ? <button disabled>لغو در حال بررسی</button> : <button onClick={() => setShowCancellation((value) => !value)}>درخواست لغو</button>}</div></div>{showCancellation && <div className="cancellation-form"><div className="refund-preview"><span>بازگشت وجه برآوردی</span><strong>{Number(selected.cancellationQuote.estimated_refund_amount).toLocaleString("fa-IR")} تومان</strong><small>{selected.cancellationQuote.refund_percentage.toLocaleString("fa-IR")}٪ از مبلغ پرداخت‌شده · محاسبه نهایی هنگام بررسی</small></div><label htmlFor="cancellation-reason">دلیل درخواست لغو</label><textarea id="cancellation-reason" rows={3} value={cancellationReason} onChange={(event) => setCancellationReason(event.target.value)} /><div><button onClick={() => setShowCancellation(false)}>انصراف</button><button disabled={cancellationPending} onClick={submitCancellation}>{cancellationPending ? "در حال ثبت…" : "ثبت درخواست"}</button></div></div>}{cancellationMessage && <p className="cancellation-message" role="status">{cancellationMessage}</p>}</div></article></section>}
        </>}
      </div>
    </section>
    <PublicFooter />
  </main>;
}
