"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { InnerHeader } from "../components/InnerHeader";
import { type ServiceOffer, fetchServices } from "../lib/api";

function priceLabel(service: ServiceOffer) {
  if (service.price_note) return service.price_note;
  const suffix = service.pricing_model === "per_guest" ? "برای هر مهمان" : service.pricing_model === "per_night" ? "برای هر شب" : service.pricing_model === "per_unit" ? `برای هر ${service.unit_label || "واحد"}` : "";
  return `از ${Number(service.base_price).toLocaleString("fa-IR")} تومان ${suffix}`.trim();
}

export default function ServicesPage() {
  const [items, setItems] = useState<ServiceOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setItems((await fetchServices()) ?? []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "دریافت خدمات در حال حاضر ممکن نیست.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const featured = items.find((item) => item.featured) ?? items[0];

  return (
    <main dir="rtl" className="inner-page service-editorial">
      <InnerHeader />
      <section className="service-editorial-hero">
        {featured?.cover_image && <img src={featured.cover_image} alt="" />}
        <div className="service-editorial-shade" />
        <div className="section-shell service-editorial-hero-copy">
          <p className="eyebrow"><span /> خدمات اقامت ویلاوان</p>
          <h1>اقامتی که برای<br /><em>شما</em> آماده شده است.</h1>
          <p>از آشپز خصوصی تا آماده‌سازی پیش از ورود؛ خدمات منتشرشده را ببینید و همان‌جا همراه رزرو ویلا انتخاب کنید.</p>
          <a href="#service-catalogue">مشاهده خدمات <span aria-hidden="true">↓</span></a>
        </div>
        <div className="service-editorial-hero-note"><span>هماهنگی انسانی</span><p>قیمت و ظرفیت نهایی هر خدمت پیش از ثبت رزرو از سرور بررسی می‌شود.</p></div>
      </section>

      <section id="service-catalogue" className="section-shell service-catalogue">
        <header className="service-catalogue-heading">
          <div><p className="eyebrow dark"><span /> مجموعه انتخاب‌شده</p><h2>جزئیات کوچک،<br />تجربه‌ای به‌یادماندنی</h2></div>
          <p>هر خدمت با محدوده، قیمت‌گذاری و شرایط روشن نمایش داده می‌شود. خدمات قابل رزرو به فاکتور اقامت اضافه می‌شوند؛ درخواست‌های اختصاصی توسط کانسیرج پیگیری خواهند شد.</p>
        </header>

        {loading ? <div className="service-catalogue-loading" aria-live="polite"><i /><i /><i /><span>در حال آماده‌سازی مجموعه خدمات…</span></div> : error ? <div className="service-catalogue-state" role="alert"><b>ارتباط با کاتالوگ خدمات برقرار نشد.</b><p>{error}</p><button type="button" onClick={() => void load()}>تلاش دوباره</button></div> : items.length === 0 ? <div className="service-catalogue-state"><b>هنوز خدمتی منتشر نشده است.</b><p>پس از آماده‌شدن اولین خدمت، جزئیات آن در همین صفحه نمایش داده می‌شود.</p><a href="/support">تماس با پشتیبانی</a></div> : <div className="service-catalogue-list">
          {items.map((service, index) => <article className={`service-editorial-card ${index % 2 ? "is-reversed" : ""}`} key={service.slug}>
            <Link className="service-editorial-visual" href={`/services/${service.slug}`} aria-label={`مشاهده ${service.title}`}>
              {service.cover_image ? <img src={service.cover_image} alt={service.title} /> : <span className="service-image-placeholder">V1</span>}
              <span className="service-card-index">{String(index + 1).padStart(2, "0")}</span>
              {service.featured && <small>انتخاب ویژه</small>}
            </Link>
            <div className="service-editorial-copy">
              <p className="service-card-category">{service.category}</p>
              <h2><Link href={`/services/${service.slug}`}>{service.title}</Link></h2>
              <p>{service.short_description || service.description}</p>
              <ul>{service.features.slice(0, 3).map((feature) => <li key={feature}>{feature}</li>)}</ul>
              <footer><div><span>شروع قیمت</span><strong>{priceLabel(service)}</strong></div><Link href={`/services/${service.slug}`}>مشاهده جزئیات <span aria-hidden="true">←</span></Link></footer>
            </div>
          </article>)}
        </div>}
      </section>

      <section className="service-concierge-band"><div className="section-shell"><p className="eyebrow"><span /> نیاز متفاوتی دارید؟</p><h2>کانسیرج ویلاوان کنار شماست.</h2><p>برای برنامه‌ریزی یک تجربه اختصاصی، قبل از رزرو با تیم پشتیبانی صحبت کنید.</p><Link href="/support">ثبت درخواست پشتیبانی</Link></div></section>
    </main>
  );
}
