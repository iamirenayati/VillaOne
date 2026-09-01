"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { InnerHeader } from "../components/InnerHeader";
import { PublicFooter } from "../components/PublicFooter";
import { PublicSelect } from "../components/PublicSelect";
import { formatShamsiDate } from "../components/ShamsiDateField";
import { InlineNotice } from "../components/ui/Feedback";
import type { VillaListing } from "../types/villa";
import { createApiBooking, fetchBookingQuote, fetchEligibleServices, fetchVilla, type BookingQuote, type ServiceOffer, type ServiceSelection, VillaOneApiError } from "../lib/api";
import styles from "./Checkout.module.css";

export default function CheckoutPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const requestedSlug = searchParams.get("slug") ?? "";
  const [villa, setVilla] = useState<VillaListing | null>(null);
  const guests = searchParams.get("guests") ?? "2";
  const checkin = searchParams.get("checkin") ?? "";
  const checkout = searchParams.get("checkout") ?? "";
  const [paymentType, setPaymentType] = useState<"deposit" | "full">("deposit");
  const [terms, setTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [guestNote, setGuestNote] = useState("");
  const [bookingError, setBookingError] = useState("");
  const [quote, setQuote] = useState<BookingQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(true);
  const [quoteError, setQuoteError] = useState("");
  const [services, setServices] = useState<ServiceOffer[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesError, setServicesError] = useState("");
  const [serviceItems, setServiceItems] = useState<ServiceSelection[]>(() => (searchParams.get("services") ?? "").split(",").filter(Boolean).map((slug) => ({ slug })));

  const rawNights = Math.round((new Date(`${checkout}T12:00:00`).getTime() - new Date(`${checkin}T12:00:00`).getTime()) / 86400000);
  const nights = Math.max(0, rawNights);
  const todayIso = new Date().toISOString().slice(0, 10);
  const validDateRange = Boolean(checkin && checkout && checkin >= todayIso && rawNights >= 2);
  const dateValidationMessage = !checkin || !checkout ? "تاریخ ورود و خروج را انتخاب کنید." : checkin < todayIso ? "تاریخ ورود نمی‌تواند در گذشته باشد." : rawNights < 2 ? "حداقل اقامت برای ثبت درخواست ۲ شب است." : "";
  const formatStayDate = (value: string) => new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${value}T12:00:00`));
  const stayTotal = quote ? Number(quote.stay_total) : 0;
  const serviceFee = quote ? Number(quote.service_fee) : 0;
  const extrasTotal = quote ? Number(quote.services_total) : 0;
  const grandTotal = quote ? Number(quote.total_price) : 0;
  const deposit = quote && paymentType === "deposit" ? Number(quote.amount_due_now) : 0;
  const payable = quote ? Number(quote.amount_due_now) : 0;

  const stayDates = Array.from({ length: Math.max(0, nights) }, (_, index) => {
    const date = new Date(`${checkin}T12:00:00`); date.setDate(date.getDate() + index); return date.toISOString().slice(0, 10);
  });

  function toggleService(service: ServiceOffer) {
    setServiceItems((current) => {
      const selected = current.some((item) => item.slug === service.slug);
      const next = selected ? current.filter((item) => item.slug !== service.slug) : [...current, { slug: service.slug, quantity: service.minimum_quantity, ...(service.schedule_type === "stay_date" ? { service_date: checkin } : {}) }];
      const params = new URLSearchParams(window.location.search);
      if (next.length) params.set("services", next.map((item) => item.slug).join(",")); else params.delete("services");
      window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
      return next;
    });
  }

  function updateService(slug: string, patch: Partial<ServiceSelection>) {
    setServiceItems((current) => current.map((item) => item.slug === slug ? { ...item, ...patch } : item));
  }

  useEffect(() => {
    let active = true;
    if (!requestedSlug) return;
    void fetchVilla(requestedSlug).then((item) => {
      if (active && item) setVilla(item);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [requestedSlug]);

  // The checkout query-string values are intentionally captured by this request callback.
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const loadServices = useCallback(async () => {
    if (!requestedSlug || !validDateRange) { setServices([]); setServicesLoading(false); return; }
    setServicesLoading(true); setServicesError("");
    try {
      const items = (await fetchEligibleServices({ villaSlug: requestedSlug, checkin, checkout })) ?? [];
      setServices(items);
      setServiceItems((current) => current.filter((selected) => items.some((item) => item.slug === selected.slug)).map((selected) => {
        const service = items.find((item) => item.slug === selected.slug)!;
        return { ...selected, quantity: selected.quantity ?? service.minimum_quantity, ...(service.schedule_type === "stay_date" && !selected.service_date ? { service_date: checkin } : {}) };
      }));
    } catch (reason) {
      setServicesError(reason instanceof Error ? reason.message : "دریافت خدمات قابل رزرو ممکن نشد.");
    } finally { setServicesLoading(false); }
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  }, [requestedSlug, checkin, checkout, validDateRange]);

  useEffect(() => {
    let active = true;
    if (active) void loadServices();
    return () => { active = false; };
  }, [loadServices]);

  useEffect(() => {
    let active = true;
    setQuoteLoading(true);
    setQuoteError("");
    if (!villa || !validDateRange) { setQuote(null); setQuoteLoading(false); return; }
    void fetchBookingQuote({ villaSlug: villa.slug, checkin, checkout, guests: Number(guests), paymentType, serviceItems })
      .then((result) => { if (active) setQuote(result); })
      .catch((error) => { if (active) { setQuote(null); setQuoteError(error instanceof Error ? error.message : "محاسبه قیمت انجام نشد."); } })
      .finally(() => { if (active) setQuoteLoading(false); });
    return () => { active = false; };
  }, [villa, checkin, checkout, guests, paymentType, serviceItems, validDateRange]);

  async function completePayment() {
    if (!terms || !villa || !validDateRange) return;
    setSubmitting(true);
    setBookingError("");
    try {
      const apiBooking = await createApiBooking({
        villaSlug: villa.slug,
        checkin,
        checkout,
        guests: Number(guests),
        paymentType,
        guestNote,
        serviceItems,
        clientRequestId: window.sessionStorage.getItem("villaone-booking-request-id") || (() => { const id = crypto.randomUUID(); window.sessionStorage.setItem("villaone-booking-request-id", id); return id; })(),
      });
      window.sessionStorage.removeItem("villaone-booking-request-id");
      router.push(`/payment?code=${encodeURIComponent(apiBooking.code)}`);
    } catch (error) {
      setBookingError(error instanceof VillaOneApiError ? error.message : "ثبت رزرو انجام نشد؛ لطفاً دوباره تلاش کنید.");
      setSubmitting(false);
    }
  }

  if (!villa) return <main dir="rtl" className={`${styles.page} inner-page checkout-page`}><InnerHeader /><section className="checkout-shell section-shell"><div className="account-empty"><span>!</span><h1>اطلاعات رزرو پیدا نشد</h1><p>برای ادامه، ابتدا یک ویلا و تاریخ معتبر انتخاب کنید.</p><a href="/villas">بازگشت به ویلاها</a></div></section><PublicFooter /></main>;

  return (
    <main dir="rtl" className={`${styles.page} inner-page checkout-page`}>
      <InnerHeader />
      <section className="checkout-shell section-shell">
        <div className="checkout-topline">
          <a href={`/villas/${villa.slug}`}>→ بازگشت به {villa.title}</a>
          <div className="checkout-progress"><span className="done"><i>✓</i> انتخاب ویلا</span><b /><span className="current"><i>۲</i> اطلاعات و درخواست</span><b /><span><i>۳</i> پیگیری کانسیرج</span></div>
          <small>ثبت درخواست با پیگیری کانسیرج</small>
        </div>

        <header className="checkout-heading">
          <p className="eyebrow dark"><span /> نهایی‌کردن رزرو</p>
          <h1>فقط چند جزئیات<br />تا شروع سفر</h1>
        </header>

        <div className="checkout-layout">
          <div className="checkout-form">
            <section className="checkout-section">
              <div className="checkout-section-head"><span>۰۱</span><div><h2>اطلاعات مهمان</h2><p>برای هماهنگی ورود و صدور رسید</p></div></div>
              <div className="checkout-identity-card"><span aria-hidden="true">✓</span><div><b>اطلاعات از حساب تأییدشده شما دریافت می‌شود</b><p>شماره موبایل حساب برای هماهنگی رزرو و صدور رسید استفاده خواهد شد. مدرک شناسایی فقط هنگام ورود بررسی می‌شود.</p></div><a href="/account">بررسی اطلاعات حساب</a></div>
            </section>

            <section className="checkout-section">
              <div className="checkout-section-head"><span>۰۲</span><div><h2>روش پرداخت</h2><p>برای رزروهای لوکس، پرداخت بیعانه هم ممکن است</p></div></div>
              <div className="payment-options">
                <button className={paymentType === "deposit" ? "selected" : ""} type="button" onClick={() => setPaymentType("deposit")}>
                  <i>{paymentType === "deposit" ? "●" : "○"}</i><div><span className="recommended">پیشنهاد ویلاوان</span><h3>بیعانه برای تأیید رزرو</h3><p>{deposit.toLocaleString("fa-IR")} تومان را در مرحله بعد کارت‌به‌کارت می‌کنید؛ باقی‌مانده طبق شرایط رزرو پرداخت می‌شود.</p></div><strong>{deposit.toLocaleString("fa-IR")}<small> تومان</small></strong>
                </button>
                <button className={paymentType === "full" ? "selected" : ""} type="button" onClick={() => setPaymentType("full")}>
                  <i>{paymentType === "full" ? "●" : "○"}</i><div><h3>تسویه کامل</h3><p>مبلغ کامل رزرو را در مرحله بعد کارت‌به‌کارت می‌کنید و رسید برای تیم مالی ارسال می‌شود.</p></div><strong>{grandTotal.toLocaleString("fa-IR")}<small> تومان</small></strong>
                </button>
              </div>
              <div className="gateway-row"><div><span className="gateway-symbol">V1</span><p><b>پرداخت کارت‌به‌کارت</b>پس از ثبت درخواست، شماره کارت امن و فرم ارسال رسید نمایش داده می‌شود.</p></div><span>مرحله بعد: ارسال رسید</span></div>
            </section>

            <section className="checkout-section extras-section">
              <div className="checkout-section-head"><span>۰۳</span><div><h2>خدمات تکمیلی سفر</h2><p>هر چیزی که دوست دارید از قبل برای اقامتتان آماده باشد انتخاب کنید.</p></div></div>
              <div className="booking-addons" role="group" aria-label="خدمات تکمیلی رزرو">
                {servicesLoading ? <p className="addons-empty" aria-live="polite">در حال بررسی خدمات قابل ارائه برای این ویلا و تاریخ…</p> : servicesError ? <div className="addons-error" role="alert"><p>{servicesError}</p><button type="button" onClick={() => void loadServices()}>تلاش دوباره</button></div> : services.length === 0 ? <p className="addons-empty">برای این ویلا و بازه اقامت، خدمت قابل رزروی منتشر نشده است. رزرو ویلا بدون خدمات تکمیلی ادامه دارد.</p> : services.map((service) => {
                  const selection = serviceItems.find((item) => item.slug === service.slug);
                  const selected = Boolean(selection);
                  return <div className={`addon-card-wrap ${selected ? "selected" : ""}`} key={service.slug}>
                    <label className={`addon-card ${selected ? "selected" : ""}`}>
                      <input type="checkbox" checked={selected} onChange={() => toggleService(service)} />
                      <span className="addon-check">{selected ? "✓" : ""}</span><span className="addon-copy"><b>{service.title}</b><small>{service.short_description || service.description}</small><em>{service.price_note}</em></span><strong>{Number(service.base_price).toLocaleString("fa-IR")} <small>تومان</small></strong>
                    </label>
                    {selection && <div className="addon-config" aria-label={`تنظیمات ${service.title}`}>
                      {service.schedule_type === "stay_date" && <PublicSelect className="addon-select" label="روز ارائه" value={selection.service_date ?? checkin} onChange={(serviceDate) => updateService(service.slug, { service_date: serviceDate })} options={stayDates.map((date) => ({ value: date, label: formatStayDate(date) }))} />}
                      {service.pricing_model === "per_unit" && <PublicSelect className="addon-select" label={`تعداد ${service.unit_label || "واحد"}`} value={String(selection.quantity ?? service.minimum_quantity)} onChange={(quantity) => updateService(service.slug, { quantity: Number(quantity) })} options={Array.from({ length: service.maximum_quantity - service.minimum_quantity + 1 }, (_, index) => service.minimum_quantity + index).map((quantity) => ({ value: String(quantity), label: quantity.toLocaleString("fa-IR") }))} />}
                      <PublicSelect className="addon-select" label="زمان ترجیحی" value={selection.time_slot ?? ""} onChange={(timeSlot) => updateService(service.slug, { time_slot: timeSlot ? timeSlot as NonNullable<ServiceSelection["time_slot"]> : undefined })} options={[{ value: "", label: "بدون ترجیح" }, { value: "breakfast", label: "صبحانه" }, { value: "lunch", label: "ناهار" }, { value: "dinner", label: "شام" }, { value: "morning", label: "صبح" }, { value: "afternoon", label: "بعدازظهر" }, { value: "evening", label: "عصر" }, { value: "flexible", label: "انعطاف‌پذیر" }]} />
                      <label className="addon-note"><span>یادداشت برای ارائه‌دهنده <small>اختیاری</small></span><input value={selection.note ?? ""} maxLength={500} onChange={(event) => updateService(service.slug, { note: event.target.value })} placeholder="حساسیت غذایی، مناسبت یا درخواست خاص…" /></label>
                    </div>}
                  </div>;
                })}
              </div>
              {extrasTotal > 0 && <p className="addons-total">خدمات انتخاب‌شده: <b>{extrasTotal.toLocaleString("fa-IR")} تومان</b> · مبلغ نهایی در فاکتور شما ثبت می‌شود.</p>}
            </section>

            <section className="checkout-section extras-section">
              <div className="checkout-section-head"><span>۰۴</span><div><h2>جزئیات سفر</h2><p>کمک می‌کند میزبان بهتر آماده شود</p></div></div>
              <label className="wide-field"><span>مناسبت یا درخواست خاص <small>اختیاری</small></span><textarea value={guestNote} onChange={(event) => setGuestNote(event.target.value)} placeholder="مثلاً برای جشن تولد کوچک سفر می‌کنیم یا نیاز به تخت کودک داریم..." /></label>
              <p className="identity-note">تخفیف‌ها و شرایط ویژه در این نسخه توسط کانسیرج بررسی و در رسید نهایی ثبت می‌شوند.</p>
            </section>
          </div>

          <aside className="checkout-summary-wrap">
            <div className="checkout-summary">
              <div className="summary-villa">{villa.image ? <img src={villa.image} alt={villa.title} /> : <span className="summary-villa-placeholder" aria-hidden="true">V1</span>}<div><span>{villa.city} · {villa.setting}</span><h2>{villa.title}</h2><p>★ {villa.rating} · {villa.reviews.toLocaleString("fa-IR")} نظر</p></div></div>
              <div className="summary-dates"><div><span>ورود</span><strong>{formatStayDate(checkin)}</strong><small dir="ltr">{formatShamsiDate(checkin)}</small><small>بعد از ساعت ۱۵</small></div><i>←</i><div><span>خروج</span><strong>{formatStayDate(checkout)}</strong><small dir="ltr">{formatShamsiDate(checkout)}</small><small>تا ساعت ۱۲</small></div></div>
              <div className="summary-guests"><span>مدت اقامت</span><b>{nights.toLocaleString("fa-IR")} شب · {Number(guests).toLocaleString("fa-IR")} مهمان</b></div>
              <div className="summary-price"><p><span>{nights.toLocaleString("fa-IR")} شب اقامت</span><b>{stayTotal.toLocaleString("fa-IR")} تومان</b></p>{extrasTotal > 0 && <p><span>خدمات انتخابی</span><b>{extrasTotal.toLocaleString("fa-IR")} تومان</b></p>}<p><span>هزینه خدمات ویلاوان</span><b>{serviceFee === 0 ? "رایگان" : `${serviceFee.toLocaleString("fa-IR")} تومان`}</b></p><p className="summary-total"><span>مبلغ کل رزرو</span><strong>{grandTotal.toLocaleString("fa-IR")} تومان</strong></p><p className="pay-now"><span>مبلغ قابل پرداخت در مرحله بعد</span><strong>{quoteLoading ? "در حال محاسبه…" : `${payable.toLocaleString("fa-IR")} تومان`}</strong></p></div>
              <label className="terms-row"><input type="checkbox" checked={terms} onChange={(event) => setTerms(event.target.checked)} /><span><a href="/terms">قوانین اقامت</a>، <a href="/cancellation">سیاست کنسلی</a> و شرایط پرداخت ویلاوان را خوانده‌ام و می‌پذیرم.</span></label>
              {dateValidationMessage && <InlineNotice tone="warning" message={dateValidationMessage} />}
              <button className="final-pay-button" type="button" disabled={!terms || submitting || quoteLoading || Boolean(quoteError) || !validDateRange} onClick={completePayment}>{submitting ? "در حال ثبت درخواست..." : quoteLoading ? "در حال دریافت قیمت نهایی…" : `ثبت درخواست و نگه‌داری زمان`}</button>
              {quoteError && <p className="checkout-api-error" role="alert">{quoteError}</p>}
              {bookingError && <p className="checkout-api-error" role="alert">{bookingError}</p>}
            </div>
            <a className="summary-support" href="/support"><span>؟</span><p><b>سؤالی درباره پرداخت دارید؟</b>کانسیرج ویلاوان همراه شماست.</p><i>←</i></a>
          </aside>
        </div>
      </section>
      <PublicFooter />
    </main>
  );
}
