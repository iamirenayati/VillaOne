"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { InnerHeader } from "../../components/InnerHeader";
import { InquiryForm } from "../../components/InquiryForm";
import { type Contractor, type ContractorCatalogItem, fetchContractor } from "../../lib/api";

function formatBudget(value: number) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toLocaleString("fa-IR", { maximumFractionDigits: 1 })} میلیارد`;
  return `${Math.round(value / 1_000_000).toLocaleString("fa-IR")} میلیون`;
}

function PriceRange({ entry }: { entry: ContractorCatalogItem }) {
  return <div className="contractor-price-range">
    <span>بازه برآورد اولیه</span>
    <strong>{formatBudget(entry.price_from)} <i>تا</i> {formatBudget(entry.price_to)} <small>تومان</small></strong>
    {entry.price_note && <p>{entry.price_note}</p>}
  </div>;
}

function CatalogImage({ entry }: { entry: ContractorCatalogItem }) {
  return <div className="catalog-card-image contractor-catalog-image">
    {entry.image ? <img src={entry.image} alt={entry.title} loading="lazy" /> : <span className="contractor-image-fallback" aria-hidden="true"><i>V1</i> تصویر پروژه به‌زودی</span>}
  </div>;
}

function ProjectShowcase({ entry, index }: { entry: ContractorCatalogItem; index: number }) {
  return <article id={`project-${index + 1}`} className={index % 2 ? "contractor-project-showcase is-reversed" : "contractor-project-showcase"}>
    <div className="contractor-project-visual">
      <CatalogImage entry={entry} />
      <span className="contractor-project-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
      {entry.area && <span className="contractor-project-area">{entry.area}</span>}
    </div>
    <div className="contractor-project-copy">
      <p className="contractor-project-kicker">پکیج طراحی و اجرا</p>
      <h3>{entry.title}</h3>
      <p className="contractor-project-subtitle">{entry.subtitle}</p>
      <p className="contractor-project-description">{entry.description}</p>
      <div className="contractor-project-facts">
        <span><small>زمان تقریبی</small><strong>{entry.timeline}</strong></span>
        <span><small>مناسب برای</small><strong>{entry.ideal_for || entry.area || "پس از بررسی پروژه"}</strong></span>
      </div>
      <PriceRange entry={entry} />
      <div className="catalog-report">
        {entry.scope && <div className="catalog-report-block"><h4>دامنه کار</h4><p>{entry.scope}</p></div>}
        {(entry.deliverables ?? entry.features).length > 0 && <div className="catalog-report-block"><h4>تحویل‌دادنی‌ها</h4><ul>{(entry.deliverables ?? entry.features).map((feature) => <li key={feature}><span aria-hidden="true">✓</span>{feature}</li>)}</ul></div>}
        {(entry.materials ?? []).length > 0 && <div className="catalog-report-block"><h4>متریال پیشنهادی</h4><ul>{(entry.materials ?? []).map((material) => <li key={material}>{material}</li>)}</ul></div>}
      </div>
      <a className="contractor-project-cta" href="#contractor-inquiry">درخواست برآورد این مدل <span aria-hidden="true">←</span></a>
    </div>
  </article>;
}

function ProductCard({ entry, index }: { entry: ContractorCatalogItem; index: number }) {
  return <article className="contractor-product-card">
    <CatalogImage entry={entry} />
    <div className="contractor-product-content">
      <header><span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><small>{entry.timeline}</small></header>
      <h3>{entry.title}</h3>
      <p className="contractor-project-subtitle">{entry.subtitle}</p>
      <p>{entry.description}</p>
      <PriceRange entry={entry} />
      {(entry.deliverables ?? entry.features).length > 0 && <ul>{(entry.deliverables ?? entry.features).map((feature) => <li key={feature}>{feature}</li>)}</ul>}
    </div>
  </article>;
}

function ContractorCatalog({ item }: { item: Contractor }) {
  const projects = item.catalog.filter((entry) => entry.type === "project");
  const products = item.catalog.filter((entry) => entry.type === "product");
  if (!item.catalog.length) return null;

  return <section className="contractor-catalog contractor-catalog-v2">
    <nav className="contractor-catalog-nav" aria-label="فهرست کاتالوگ">
      <div className="section-shell">
        <a href="#catalog-projects">پکیج‌های ساخت <span>{projects.length.toLocaleString("fa-IR")}</span></a>
        {products.length > 0 && <a href="#catalog-products">خدمات تکمیلی <span>{products.length.toLocaleString("fa-IR")}</span></a>}
        <a className="is-cta" href="#contractor-inquiry">درخواست برآورد</a>
      </div>
    </nav>

    {projects.length > 0 && <div id="catalog-projects" className="section-shell contractor-projects-section">
      <header className="contractor-catalog-heading">
        <div><p className="eyebrow dark"><span /> کاتالوگ پروژه</p><h2>مدل‌های ساخت،<br />برای شروع یک تصمیم واقعی</h2></div>
        <p>قیمت، زمان و دامنه هر مدل از داده منتشرشده همین تیم می‌آید. این بازه‌ها برای مقایسه اولیه‌اند؛ شرایط زمین، مجوز و انتخاب متریال در برآورد نهایی اثر می‌گذارد.</p>
      </header>
      <div className="contractor-project-list">{projects.map((entry, index) => <ProjectShowcase key={`${entry.title}-${index}`} entry={entry} index={index} />)}</div>
    </div>}

    {products.length > 0 && <div id="catalog-products" className="contractor-products-section">
      <div className="section-shell">
        <header className="contractor-products-heading"><div><p className="eyebrow"><span /> خدمات تکمیلی</p><h2>جزئیاتی که پروژه را کامل می‌کنند</h2></div><p>برای طراحی مستقل، بازسازی یا تکمیل محوطه می‌توانید فقط همان بخش موردنیاز را درخواست کنید.</p></header>
        <div className="contractor-product-grid">{products.map((entry, index) => <ProductCard key={`${entry.title}-${index}`} entry={entry} index={index} />)}</div>
      </div>
    </div>}

    <div className="section-shell"><div className="contractor-pricing-note"><span aria-hidden="true">i</span><p><strong>این اعداد قیمت قطعی یا پیشنهاد قرارداد نیستند.</strong> هزینه زمین، مجوز، شرایط دسترسی، نوع سازه و انتخاب متریال می‌تواند مبلغ نهایی را تغییر دهد. برای برآورد دقیق، اطلاعات پروژه را در فرم بالا ثبت کنید.</p></div></div>
  </section>;
}

function ContractorProfile({ item }: { item: Contractor }) {
  return <>
    <section className="contractor-profile-hero">
      {item.cover_image ? <img src={item.cover_image} alt="" /> : <span className="contractor-image-fallback" aria-hidden="true"><i>V1</i> تصویر پروفایل به‌زودی</span>}
      <div className="contractor-profile-shade" />
      <div className="section-shell contractor-profile-hero-content">
        <a className="contractor-back-link" href="/contractors"><span aria-hidden="true">→</span> بازگشت به متخصصان</a>
        <div className="contractor-profile-badges">{item.featured && <span>منتخب ویلاوان</span>}{item.verified && <span><i aria-hidden="true">✓</i> بررسی اولیه ویلاوان</span>}</div>
        <p>{item.specialty}</p>
        <h1>{item.name}</h1>
        <div className="contractor-profile-meta"><span>{item.city}</span><span>{item.years_experience.toLocaleString("fa-IR")} سال تجربه</span><span>{item.services.length.toLocaleString("fa-IR")} خدمت قابل درخواست</span></div>
        <a className="contractor-profile-cta" href="#contractor-inquiry">درخواست برآورد پروژه <span aria-hidden="true">↓</span></a>
      </div>
    </section>

    <section className="contractor-profile-overview section-shell">
      <article className="contractor-profile-story">
        <p className="eyebrow dark"><span /> درباره تیم</p>
        <h2>{item.specialty}</h2>
        <p className="contractor-profile-description">{item.description}</p>
        {item.services.length > 0 && <><h3>حوزه‌های همکاری</h3><ul>{item.services.map((service, index) => <li key={service}><span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>{service}</li>)}</ul></>}
        <div className="contractor-trust-note"><span aria-hidden="true">✓</span><p><strong>معرفی شفاف، بدون ادعای اضافه</strong>برآورد نهایی قیمت، زمان و ضمانت اجرا پس از بازدید و قرارداد مستقیم با پیمانکار مشخص می‌شود.</p></div>
      </article>
      <aside id="contractor-inquiry" className="contractor-inquiry-column"><InquiryForm kind="contractor" targetSlug={item.slug} title={item.name} /><p><span aria-hidden="true">●</span> پاسخ‌گویی و هماهنگی اولیه توسط تیم ویلاوان انجام می‌شود.</p></aside>
    </section>

    <ContractorCatalog item={item} />
  </>;
}

export default function ContractorDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [item, setItem] = useState<Contractor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchContractor(slug);
      if (!data) throw new Error("این متخصص پیدا نشد یا در حال حاضر منتشر نیست.");
      setItem(data);
    } catch (reason) {
      setItem(null);
      setError(reason instanceof Error ? reason.message : "دریافت اطلاعات انجام نشد.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { void load(); }, [load]);

  return <main dir="rtl" className="inner-page market-detail contractor-profile-page">
    <InnerHeader />
    {loading ? <div className="contractor-profile-loading section-shell" role="status" aria-live="polite" aria-busy="true"><span className="status-pulse" /><p>در حال آماده‌سازی کاتالوگ…</p></div> : error ? <div className="market-state section-shell market-state-error" role="alert"><strong>{error}</strong><span>ممکن است پروفایل منتشر نشده باشد یا ارتباط با سرور قطع شده باشد.</span><button type="button" onClick={() => void load()}>تلاش دوباره</button><a className="text-link" href="/contractors">بازگشت به متخصصان</a></div> : item ? <ContractorProfile item={item} /> : null}
  </main>;
}
