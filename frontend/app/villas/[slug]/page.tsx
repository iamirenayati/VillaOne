"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AvailabilityCalendar } from "../../components/AvailabilityCalendar";
import { BrandMark } from "../../components/BrandLogo";
import { InnerHeader } from "../../components/InnerHeader";
import { ShamsiDateField } from "../../components/ShamsiDateField";
import type { VillaListing } from "../../types/villa";
import { type BookingQuote, type VillaReview, fetchBookingQuote, fetchFavoriteVillas, fetchVilla, fetchVillaAvailability, fetchVillaReviews, hasAuthenticatedSession, requestOtp, toggleVillaFavorite, verifyOtp, VillaOneApiError } from "../../lib/api";

const emptyVilla: VillaListing = { slug: "", title: "", city: "", region: "", setting: "", description: "", price: 0, priceLabel: "۰", depositPercentage: 0, guests: 0, rooms: 0, beds: 0, baths: 0, rating: "جدید", reviews: 0, badge: "", instant: false, pool: false, image: "", gallery: [], tags: [] };

function dateFromToday(offset: number) {
  const value = new Date();
  value.setDate(value.getDate() + offset);
  return value.toISOString().slice(0, 10);
}

function DetailSkeleton() {
  return <section className="detail-page-skeleton section-shell" aria-busy="true" aria-label="در حال دریافت اطلاعات ویلا"><i /><span /><b /><div><span /><span /><span /></div></section>;
}

export default function VillaDetailPage() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const [villa, setVilla] = useState<VillaListing>(emptyVilla);
  const gallery = [...new Set([villa.image, ...villa.gallery].filter(Boolean))];
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loadRevision, setLoadRevision] = useState(0);
  const [favorite, setFavorite] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  const [activePhoto, setActivePhoto] = useState<number | null>(null);
  const [bookingStep, setBookingStep] = useState<0 | 1 | 2>(0);
  const [phone, setPhone] = useState("");
  const [guests, setGuests] = useState(searchParams.get("guests") || "2");
  const [otp, setOtp] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [checkin, setCheckin] = useState(searchParams.get("checkin") || dateFromToday(1));
  const [checkout, setCheckout] = useState(searchParams.get("checkout") || dateFromToday(3));
  const requestedServices = searchParams.get("services") || searchParams.get("service") || "";
  const [dateMessage, setDateMessage] = useState("");
  const [datesAvailable, setDatesAvailable] = useState<boolean | null>(null);
  const [unavailableDates, setUnavailableDates] = useState<string[]>([]);
  const [quote, setQuote] = useState<BookingQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(true);
  const [reviews, setReviews] = useState<VillaReview[]>([]);
  const nights = Math.max(0, Math.round((new Date(`${checkout}T12:00:00`).getTime() - new Date(`${checkin}T12:00:00`).getTime()) / 86_400_000));
  const stayTotal = quote ? Number(quote.stay_total) : 0;
  const serviceFee = quote ? Number(quote.service_fee) : 0;
  const total = quote ? Number(quote.total_price) : stayTotal;
  const dueNow = quote ? Number(quote.amount_due_now) : 0;

  useEffect(() => {
    let active = true;
    setLoadState("loading");
    setVilla(emptyVilla);
    fetchVilla(params.slug).then((item) => {
      if (!active) return;
      if (!item) setLoadState("error");
      else {
        setVilla(item);
        setGuests((current) => String(Math.min(Math.max(Number(current) || 1, 1), item.guests)));
        setLoadState("ready");
      }
    }).catch(() => { if (active) setLoadState("error"); });
    fetchVillaReviews(params.slug).then((items) => { if (active) setReviews(items ?? []); }).catch(() => { if (active) setReviews([]); });
    const start = new Date();
    const end = new Date(start);
    end.setDate(end.getDate() + 180);
    const toIso = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
    fetchVillaAvailability(params.slug, toIso(start), toIso(end)).then((days) => { if (active) setUnavailableDates((days ?? []).filter((day) => day.status !== "open").map((day) => day.date)); }).catch(() => { if (active) setUnavailableDates([]); });
    return () => { active = false; };
  }, [loadRevision, params.slug]);

  useEffect(() => {
    if (!hasAuthenticatedSession()) return;
    void fetchFavoriteVillas().then((items) => setFavorite(Boolean(items?.some((item) => item.slug === params.slug)))).catch(() => undefined);
  }, [params.slug]);

  useEffect(() => {
    if (activePhoto === null) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setActivePhoto(null); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activePhoto]);

  useEffect(() => {
    if (!checkin || !checkout || nights < 2) {
      setDatesAvailable(false);
      setDateMessage("حداقل اقامت این ویلا ۲ شب است.");
      return;
    }
    setDatesAvailable(null);
    setDateMessage("در حال بررسی تاریخ‌ها…");
    fetchVillaAvailability(params.slug, checkin, checkout).then((days) => {
      if (!days) { setDatesAvailable(false); setDateMessage("بررسی دسترسی انجام نشد."); return; }
      const available = days.every((day) => day.status === "open");
      setDatesAvailable(available);
      setDateMessage(available ? "این بازه برای رزرو آزاد است." : "بخشی از این بازه رزرو شده است؛ تاریخ دیگری انتخاب کنید.");
    }).catch(() => { setDatesAvailable(false); setDateMessage("بررسی تاریخ‌ها انجام نشد؛ دوباره تلاش کنید."); });
  }, [checkin, checkout, nights, params.slug]);

  useEffect(() => {
    if (!checkin || !checkout || nights < 2) { setQuote(null); setQuoteLoading(false); return; }
    let active = true;
    setQuoteLoading(true);
    void fetchBookingQuote({ villaSlug: params.slug, checkin, checkout, guests: Number(guests), paymentType: "deposit" }).then((result) => { if (active) setQuote(result); }).catch(() => { if (active) setQuote(null); }).finally(() => { if (active) setQuoteLoading(false); });
    return () => { active = false; };
  }, [checkin, checkout, guests, nights, params.slug]);

  async function handleFavorite() {
    if (!hasAuthenticatedSession()) { window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`; return; }
    const previous = favorite;
    setFavorite(!previous);
    try { const result = await toggleVillaFavorite(params.slug); if (result) setFavorite(result.saved); } catch { setFavorite(previous); }
  }

  async function handleShare() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: villa.title, text: `${villa.title} در ${villa.city}`, url });
      else { await navigator.clipboard.writeText(url); setShareMessage("پیوند کپی شد"); }
    } catch { setShareMessage(""); }
  }

  function continueToCheckout() {
    const target = `/checkout?slug=${villa.slug}&guests=${guests}&checkin=${checkin}&checkout=${checkout}${requestedServices ? `&services=${encodeURIComponent(requestedServices)}` : ""}`;
    if (hasAuthenticatedSession()) { window.location.href = target; return; }
    setBookingStep(1);
  }

  async function sendOtp() {
    if (phone.replace(/\D/g, "").length < 11) { setAuthMessage("شماره موبایل را کامل وارد کنید."); return; }
    setAuthBusy(true); setAuthMessage("");
    try { const result = await requestOtp(phone); setBookingStep(2); setAuthMessage(result.debugCode ? `کد توسعه: ${result.debugCode}` : "کد تأیید برای شما ارسال شد."); }
    catch (error) { setAuthMessage(error instanceof VillaOneApiError ? error.message : "ارسال کد ناموفق بود."); }
    finally { setAuthBusy(false); }
  }

  async function confirmOtp() {
    setAuthBusy(true); setAuthMessage("");
    try { await verifyOtp(phone, otp); window.location.href = `/checkout?slug=${villa.slug}&guests=${guests}&phone=${encodeURIComponent(phone)}&checkin=${checkin}&checkout=${checkout}${requestedServices ? `&services=${encodeURIComponent(requestedServices)}` : ""}`; }
    catch (error) { setAuthMessage(error instanceof VillaOneApiError ? error.message : "تأیید کد ناموفق بود."); }
    finally { setAuthBusy(false); }
  }

  if (loadState === "loading") return <main dir="rtl" className="inner-page villa-luxury-detail"><InnerHeader /><DetailSkeleton /></main>;
  if (loadState === "error" || !villa.slug) return <main dir="rtl" className="inner-page villa-luxury-detail"><InnerHeader /><section className="section-shell"><div className="detail-error-state" role="alert"><span>!</span><h1>این ویلا در دسترس نیست</h1><p>ممکن است اقامتگاه منتشر نشده باشد یا ارتباط با سرور موقتاً قطع شده باشد.</p><div><button type="button" onClick={() => setLoadRevision((value) => value + 1)}>تلاش دوباره</button><a href="/villas">بازگشت به ویلاها</a></div></div></section></main>;

  return <main dir="rtl" className="inner-page villa-luxury-detail">
    <InnerHeader />
    <div className="luxury-detail-shell section-shell">
      <nav className="luxury-detail-breadcrumb" aria-label="مسیر صفحه"><a href="/">خانه</a><span>←</span><a href="/villas">ویلاها</a><span>←</span><b>{villa.city}</b></nav>
      <header className="luxury-detail-heading"><div><div className="luxury-detail-kicker">{villa.badge && <span>{villa.badge}</span>}<small>{villa.city} · {villa.setting}</small></div><h1>{villa.title}</h1><p><span>{villa.reviews ? `★ ${villa.rating} از ${villa.reviews.toLocaleString("fa-IR")} نظر تأییدشده` : "اقامتگاه تازه‌منتشرشده"}</span><i />{villa.region}</p></div><div className="luxury-detail-actions"><button type="button" onClick={handleShare}>↗ <span>اشتراک‌گذاری</span></button><button type="button" className={favorite ? "is-favorite" : ""} onClick={handleFavorite}>{favorite ? "♥" : "♡"}<span>{favorite ? "ذخیره شد" : "ذخیره"}</span></button><small aria-live="polite">{shareMessage}</small></div></header>

      <section className={`luxury-detail-gallery gallery-count-${Math.min(gallery.length, 5)}`} aria-label="تصاویر اقامتگاه">
        {gallery.length ? gallery.slice(0, 5).map((image, index) => <button type="button" key={`${image}-${index}`} className={`luxury-gallery-item item-${index + 1}`} onClick={() => setActivePhoto(index)} aria-label={`باز کردن تصویر ${index + 1}`}><img src={image} alt={`${villa.title}، تصویر ${index + 1}`} /></button>) : <div className="luxury-gallery-fallback"><BrandMark /><span>تصاویر این اقامتگاه در حال تکمیل است</span></div>}
        {gallery.length > 1 && <button className="luxury-all-photos" type="button" onClick={() => setActivePhoto(0)}>▦ مشاهده {gallery.length.toLocaleString("fa-IR")} تصویر</button>}
      </section>

      <div className="luxury-detail-layout">
        <div className="luxury-detail-content">
          <section className="luxury-trust-row" aria-label="اعتماد و پشتیبانی"><article><span>✓</span><div><strong>اقامتگاه بررسی‌شده</strong><small>اطلاعات پیش از انتشار بررسی شده است</small></div></article><article><span>◇</span><div><strong>قیمت‌گذاری شفاف</strong><small>جزئیات کامل پیش از ثبت درخواست</small></div></article><article><span>◌</span><div><strong>پشتیبانی سفر</strong><small>همراه شما تا پایان اقامت</small></div></article></section>

          <section className="luxury-quick-facts" aria-label="مشخصات ویلا"><div><strong>{villa.guests.toLocaleString("fa-IR")}</strong><span>مهمان</span></div><div><strong>{villa.rooms.toLocaleString("fa-IR")}</strong><span>اتاق خواب</span></div><div><strong>{villa.beds.toLocaleString("fa-IR")}</strong><span>تخت</span></div><div><strong>{villa.baths.toLocaleString("fa-IR")}</strong><span>حمام</span></div></section>

          <section className="luxury-detail-section luxury-about-villa"><p className="eyebrow dark"><span /> روایت اقامتگاه</p><h2>درباره {villa.title}</h2><p>{villa.description || "توضیحات کامل این اقامتگاه هنوز توسط تیم محتوا تکمیل نشده است. برای دریافت اطلاعات بیشتر با پشتیبانی ویلاوان تماس بگیرید."}</p></section>

          <section className="luxury-detail-section luxury-amenities"><div><p className="eyebrow dark"><span /> امکانات ثبت‌شده</p><h2>آنچه در اختیار شماست</h2></div>{villa.tags.length ? <ul>{villa.tags.map((tag, index) => <li key={`${tag}-${index}`}><span>✓</span>{tag}</li>)}</ul> : <p className="truthful-empty-copy">فهرست امکانات این اقامتگاه هنوز تکمیل نشده است.</p>}</section>

          <section className="luxury-detail-section luxury-availability"><AvailabilityCalendar slug={params.slug} /></section>

          <section className="luxury-detail-section luxury-region"><div><p className="eyebrow dark"><span /> موقعیت تقریبی</p><h2>{villa.region}</h2><p>برای حفظ حریم خصوصی میزبان، نشانی دقیق پس از تأیید رزرو ارائه می‌شود.</p></div><a href={`/map?villa=${encodeURIComponent(villa.slug)}`}>مشاهده روی نقشه <span>←</span></a></section>

          <section className="luxury-detail-section luxury-policies"><p className="eyebrow dark"><span /> پیش از درخواست</p><h2>رزرو روشن و بدون ابهام</h2><div><article><span>۰۱</span><strong>حداقل دو شب اقامت</strong><p>سامانه بازه‌های کوتاه‌تر را تأیید نمی‌کند.</p></article><article><span>۰۲</span><strong>ثبت درخواست و مهلت پرداخت</strong><p>پس از ثبت، رزرو تا زمان درج‌شده برای پرداخت نگه داشته می‌شود.</p></article><article><span>۰۳</span><strong>بررسی رسید کارت‌به‌کارت</strong><p>رزرو پس از تأیید رسید توسط تیم مالی قطعی می‌شود.</p></article></div><footer><a href="/terms">قوانین رزرو</a><a href="/cancellation">سیاست لغو</a><a href="/support">پشتیبانی</a></footer></section>

          <section className="luxury-detail-section luxury-reviews" id="reviews"><div className="luxury-section-heading"><div><p className="eyebrow dark"><span /> تجربه مهمانان</p><h2>{villa.reviews ? `${villa.rating} از ۵` : "هنوز نظری ثبت نشده"}</h2></div>{villa.reviews > 0 && <small>{villa.reviews.toLocaleString("fa-IR")} اقامت تأییدشده</small>}</div>{reviews.length ? <div className="luxury-review-grid">{reviews.slice(0, 3).map((review) => <article key={review.id}><header><span>{review.guest_name.slice(0, 1)}</span><div><b>{review.guest_name}</b><small>{new Intl.DateTimeFormat("fa-IR-u-ca-persian", { month: "long", year: "numeric" }).format(new Date(review.created_at))}</small></div><em>{"★".repeat(review.rating)}</em></header><h3>{review.title || "تجربه اقامت"}</h3><blockquote>«{review.comment}»</blockquote></article>)}</div> : <p className="truthful-empty-copy">نظرها فقط پس از پایان اقامت و برای مهمان تأییدشده منتشر می‌شوند.</p>}</section>
        </div>

        <aside className="luxury-booking-wrap"><div className="luxury-booking-card">
          {bookingStep < 2 ? <><header><div><strong>{villa.priceLabel}</strong><span> تومان / شب</span></div><small>{villa.instant ? "رزرو آنی" : "درخواست رزرو"}</small></header>
            <div className="luxury-booking-fields"><ShamsiDateField value={checkin} onChange={setCheckin} label="ورود" disabledDates={unavailableDates} /><ShamsiDateField value={checkout} minValue={checkin} onChange={setCheckout} label="خروج" disabledDates={unavailableDates} /><label><span>مهمانان</span><select value={guests} onChange={(event) => setGuests(event.target.value)}>{Array.from({ length: villa.guests }, (_, index) => index + 1).map((count) => <option value={count} key={count}>{count.toLocaleString("fa-IR")} مهمان</option>)}</select></label></div>
            {dateMessage && <p className={datesAvailable ? "luxury-date-status is-available" : "luxury-date-status"}>{datesAvailable ? "✓" : "◌"} {dateMessage}</p>}
            {bookingStep === 1 && <label className="luxury-phone-field"><span>شماره موبایل برای ادامه</span><input dir="ltr" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="09•• ••• ••••" /></label>}
            <button className="luxury-booking-submit" type="button" disabled={authBusy || quoteLoading || !quote || datesAvailable !== true || nights < 2} onClick={() => bookingStep === 0 ? continueToCheckout() : sendOtp()}>{bookingStep === 0 ? quoteLoading ? "در حال محاسبه قیمت…" : "ادامه رزرو" : authBusy ? "در حال ارسال…" : "ارسال کد تأیید"}<span>←</span></button>
            {authMessage && <p className="luxury-auth-message" role="alert">{authMessage}</p>}
            <small className="luxury-no-charge">در این مرحله مبلغی از حساب شما کسر نمی‌شود.</small>
            <div className="luxury-price-breakdown"><p><span>{nights.toLocaleString("fa-IR")} شب اقامت</span><b>{stayTotal.toLocaleString("fa-IR")} تومان</b></p>{quote?.services.map((service) => <p key={service.slug}><span>{service.title}</span><b>{Number(service.total_price).toLocaleString("fa-IR")} تومان</b></p>)}<p><span>هزینه خدمات</span><b>{serviceFee ? `${serviceFee.toLocaleString("fa-IR")} تومان` : "رایگان"}</b></p><p className="luxury-total"><span>مبلغ کل</span><strong>{total.toLocaleString("fa-IR")} تومان</strong></p></div>
            <div className="luxury-deposit-note"><span>◇</span><p><strong>بیعانه {Number(quote?.deposit_percentage ?? villa.depositPercentage).toLocaleString("fa-IR")}٪</strong>{dueNow.toLocaleString("fa-IR")} تومان پس از ثبت درخواست از طریق کارت‌به‌کارت پرداخت می‌شود؛ رسید شما پیش از قطعی‌شدن رزرو بررسی خواهد شد.</p></div>
          </> : <div className="luxury-otp-step"><span>✓</span><small>تأیید هویت مهمان</small><h2>کد شش‌رقمی را وارد کنید</h2><p>کد ارسال‌شده به <b dir="ltr">{phone}</b></p><input dir="ltr" inputMode="numeric" maxLength={6} autoFocus value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))} placeholder="••••••" />{authMessage && <small role="status">{authMessage}</small>}<button type="button" disabled={authBusy || otp.length !== 6} onClick={confirmOtp}>{authBusy ? "در حال تأیید…" : "تأیید و ادامه"}</button><button type="button" onClick={() => setBookingStep(1)}>ویرایش شماره موبایل</button></div>}
        </div><a className="luxury-concierge-link" href="/support"><span>V1</span><div><b>برای انتخاب مطمئن نیستید؟</b><small>پشتیبانی ویلاوان راهنمای شماست</small></div><i>←</i></a></aside>
      </div>
    </div>

    {activePhoto !== null && gallery[activePhoto] && <div className="gallery-lightbox" role="dialog" aria-modal="true" aria-label="نمایش تصاویر ویلا" onClick={() => setActivePhoto(null)}><button type="button" className="gallery-lightbox-close" onClick={() => setActivePhoto(null)} aria-label="بستن تصاویر">×</button><button type="button" className="gallery-lightbox-next" onClick={(event) => { event.stopPropagation(); setActivePhoto((activePhoto + 1) % gallery.length); }} aria-label="تصویر بعدی">←</button><figure onClick={(event) => event.stopPropagation()}><img src={gallery[activePhoto]} alt={`${villa.title}، تصویر ${activePhoto + 1}`} /><figcaption>{(activePhoto + 1).toLocaleString("fa-IR")} از {gallery.length.toLocaleString("fa-IR")}</figcaption></figure><button type="button" className="gallery-lightbox-prev" onClick={(event) => { event.stopPropagation(); setActivePhoto((activePhoto - 1 + gallery.length) % gallery.length); }} aria-label="تصویر قبلی">→</button></div>}
    <footer className="mini-footer"><div className="section-shell"><span>© {new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric" }).format(new Date())} ویلاوان</span><div><a href="/support">پشتیبانی</a><a href="/terms">قوانین رزرو</a><a href="/privacy">حریم خصوصی</a></div></div></footer>
  </main>;
}
