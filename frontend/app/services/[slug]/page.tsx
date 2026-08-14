"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { InnerHeader } from "../../components/InnerHeader";
import { InquiryForm } from "../../components/InquiryForm";
import { fetchService, type ServiceOffer } from "../../lib/api";

const pricingLabels: Record<ServiceOffer["pricing_model"], string> = { fixed: "قیمت ثابت", per_guest: "به‌ازای هر مهمان", per_night: "به‌ازای هر شب", per_unit: "به‌ازای هر واحد" };

export default function ServiceDetailPage() {
  const params = useParams<{ slug: string }>();
  const [service, setService] = useState<ServiceOffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setService(await fetchService(params.slug)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "دریافت جزئیات خدمت ممکن نشد."); }
    finally { setLoading(false); }
  }, [params.slug]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <main dir="rtl" className="inner-page service-detail-page"><InnerHeader /><div className="service-detail-loading" aria-live="polite"><i /><p>در حال آماده‌سازی جزئیات خدمت…</p></div></main>;
  if (error || !service) return <main dir="rtl" className="inner-page service-detail-page"><InnerHeader /><div className="service-detail-error"><span>!</span><h1>این خدمت در دسترس نیست.</h1><p>{error || "ممکن است این خدمت هنوز منتشر نشده باشد."}</p><button type="button" onClick={() => void load()}>تلاش دوباره</button><Link href="/services">بازگشت به خدمات</Link></div></main>;

  const bookable = service.fulfillment_mode !== "inquiry_only";
  const inquiryAvailable = service.fulfillment_mode !== "bookable";
  return <main dir="rtl" className="inner-page service-detail-page">
    <InnerHeader />
    <section className="service-detail-hero">
      {service.cover_image ? <img src={service.cover_image} alt={service.title} /> : <span className="service-image-placeholder">V1</span>}
      <div className="service-detail-shade" />
      <div className="section-shell service-detail-hero-copy"><Link href="/services">بازگشت به مجموعه خدمات</Link><p>{service.category}</p><h1>{service.title}</h1><span>{service.short_description}</span></div>
      <div className="service-detail-price"><small>{pricingLabels[service.pricing_model]}</small><strong>{Number(service.base_price).toLocaleString("fa-IR")} <em>تومان</em></strong><p>{service.price_note}</p></div>
    </section>

    <section className="section-shell service-detail-overview">
      <div className="service-detail-story"><p className="eyebrow dark"><span /> درباره این تجربه</p><h2>همه‌چیز روشن،<br />پیش از انتخاب</h2><p className="service-detail-description">{service.description}</p>
        {service.features.length > 0 && <div className="service-detail-features">{service.features.map((feature, index) => <div key={feature}><span>{String(index + 1).padStart(2, "0")}</span><p>{feature}</p></div>)}</div>}
      </div>
      <aside className="service-booking-card"><span>رزرو و هماهنگی</span><h2>{bookable ? "همراه اقامت انتخاب کنید" : "درخواست اختصاصی بفرستید"}</h2><p>{bookable ? "تاریخ، تعداد و قیمت نهایی در مرحله رزرو و براساس ظرفیت واقعی بررسی می‌شود." : "تیم ویلاوان درخواست را بررسی می‌کند و برای جزئیات با شما تماس می‌گیرد."}</p>
        <dl><div><dt>حداقل زمان هماهنگی</dt><dd>{service.minimum_lead_hours.toLocaleString("fa-IR")} ساعت</dd></div><div><dt>شیوه قیمت‌گذاری</dt><dd>{pricingLabels[service.pricing_model]}</dd></div>{service.unit_label && <div><dt>واحد خدمت</dt><dd>{service.unit_label}</dd></div>}</dl>
        {bookable && <Link className="service-primary-cta" href={`/villas?service=${encodeURIComponent(service.slug)}`}>انتخاب ویلا و تاریخ <span>←</span></Link>}
        {inquiryAvailable && <a className="service-secondary-cta" href="#service-inquiry">درخواست هماهنگی اختصاصی</a>}
      </aside>
    </section>

    {(service.inclusions.length > 0 || service.exclusions.length > 0) && <section className="service-scope"><div className="section-shell"><div><p className="eyebrow"><span /> محدوده خدمت</p><h2>چه چیزهایی در این تجربه قرار دارد؟</h2></div><div className="service-scope-columns">{service.inclusions.length > 0 && <article><h3>شامل می‌شود</h3><ul>{service.inclusions.map((item) => <li key={item}>{item}</li>)}</ul></article>}{service.exclusions.length > 0 && <article className="is-muted"><h3>شامل نمی‌شود</h3><ul>{service.exclusions.map((item) => <li key={item}>{item}</li>)}</ul></article>}</div></div></section>}

    {(service.preparation_notes || service.cancellation_text) && <section className="section-shell service-policies"><div><span>پیش از تجربه</span><h3>نکات آماده‌سازی</h3><p>{service.preparation_notes || "نیاز به آماده‌سازی ویژه‌ای ثبت نشده است."}</p></div><div><span>تغییر برنامه</span><h3>شرایط لغو خدمت</h3><p>{service.cancellation_text || "شرایط لغو هنگام هماهنگی نهایی اعلام می‌شود."}</p></div></section>}

    {service.gallery.length > 0 && <section className="section-shell service-gallery"><header><p className="eyebrow dark"><span /> نمای نزدیک</p><h2>تصویری از تجربه</h2></header><div>{service.gallery.map((image) => <figure key={image.id}><img src={image.image} alt={image.alt_text || service.title} /></figure>)}</div></section>}

    {inquiryAvailable && <section id="service-inquiry" className="service-inquiry"><div className="section-shell"><div><p className="eyebrow"><span /> درخواست اختصاصی</p><h2>جزئیات را با ما در میان بگذارید.</h2><p>ارسال فرم به معنی تأیید یا پرداخت نیست. کانسیرج برای بررسی زمان، ظرفیت و هزینه با شما تماس می‌گیرد.</p></div><InquiryForm kind="service" targetSlug={service.slug} title={service.title} /></div></section>}
  </main>;
}
