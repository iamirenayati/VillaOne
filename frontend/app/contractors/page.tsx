/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { InnerHeader } from "../components/InnerHeader";
import { PublicFooter } from "../components/PublicFooter";
import { EmptyState, ErrorState } from "../components/ui/Feedback";
import { type Contractor, fetchContractors } from "../lib/api";
import styles from "./Contractor.module.css";

function ContractorPortrait({ item }: { item: Contractor }) {
  return <Link className="contractor-showcase-visual" href={`/contractors/${item.slug}`} aria-label={`مشاهده پروفایل ${item.name}`}>
    {item.cover_image ? <img src={item.cover_image} alt="" /> : <span className="contractor-image-fallback" aria-hidden="true"><i>V1</i> تصویر به‌زودی</span>}
    <span className="contractor-showcase-index" aria-hidden="true">{String(item.id).padStart(2, "0")}</span>
    {item.featured && <span className="contractor-featured-ribbon">منتخب ویلاوان</span>}
  </Link>;
}

function ContractorShowcase({ item, index }: { item: Contractor; index: number }) {
  return <article className={index % 2 ? "contractor-showcase is-reversed" : "contractor-showcase"}>
    <ContractorPortrait item={item} />
    <div className="contractor-showcase-copy">
      <div className="contractor-directory-meta">
        <span>{item.city}</span>
        <span>{item.years_experience.toLocaleString("fa-IR")} سال تجربه</span>
        {item.verified && <span className="is-verified"><i aria-hidden="true">✓</i> بررسی اولیه ویلاوان</span>}
      </div>
      <p className="contractor-showcase-kicker">{item.specialty}</p>
      <h2><Link href={`/contractors/${item.slug}`}>{item.name}</Link></h2>
      <p className="contractor-showcase-description">{item.description}</p>
      {item.services.length > 0 && <ul className="contractor-service-tags" aria-label="خدمات قابل درخواست">
        {item.services.slice(0, 4).map((service) => <li key={service}>{service}</li>)}
      </ul>}
      <footer>
        <Link className="contractor-primary-link" href={`/contractors/${item.slug}`}>مشاهده کاتالوگ و خدمات <span aria-hidden="true">←</span></Link>
        <small>معرفی و پیگیری توسط کانسیرج ویلاوان</small>
      </footer>
    </div>
  </article>;
}

function ContractorLoading() {
  return <div className="contractor-loading" role="status" aria-live="polite" aria-busy="true">
    <span className="sr-only">در حال دریافت متخصصان…</span>
    <div /><div /><div />
  </div>;
}

export default function ContractorsPage() {
  const [items, setItems] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchContractors();
      if (data === null) throw new Error("در حال حاضر فهرست متخصصان در دسترس نیست.");
      setItems(data);
    } catch (reason) {
      setItems([]);
      setError(reason instanceof Error ? reason.message : "دریافت متخصصان انجام نشد.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return <main dir="rtl" className={`${styles.page} inner-page market-page contractor-page contractor-directory-v2`}>
    <InnerHeader />
    <section className="contractor-editorial-hero">
      <img className="contractor-hero-art" src="/images/editorial/architecture-studio.webp" alt="" width="960" height="1200" fetchPriority="high" />
      <div className="contractor-hero-shade" aria-hidden="true" />
      <div className="section-shell contractor-editorial-hero-inner">
        <div className="contractor-hero-copy">
          <p className="eyebrow"><span /> شبکه تخصصی ساخت در مازندران</p>
          <h1>چند تیم خوب،<br /><em>برای انتخابی مطمئن.</em></h1>
          <p>به‌جای فهرستی شلوغ، مجموعه‌ای محدود از تیم‌های معماری و اجرا را معرفی می‌کنیم؛ مناسب پروژه‌های واقعی ویلا در اقلیم شمال.</p>
          <div className="contractor-hero-actions">
            <a className="contractor-hero-primary" href="#contractors">دیدن متخصصان <span aria-hidden="true">↓</span></a>
            <Link href="/support">مشاوره با ویلاوان</Link>
          </div>
        </div>
        <aside className="contractor-hero-note" aria-label="نحوه همکاری">
          <span aria-hidden="true">01</span>
          <p>درخواست شما ابتدا توسط تیم ویلاوان بررسی می‌شود.</p>
          <span aria-hidden="true">02</span>
          <p>یک متخصص متناسب با شهر، بودجه و نوع پروژه معرفی می‌شود.</p>
          <span aria-hidden="true">03</span>
          <p>بازدید، برآورد و قرارداد مستقیماً با پیمانکار انجام می‌شود.</p>
        </aside>
      </div>
    </section>

    <section className="contractor-directory section-shell" id="contractors">
      <header className="contractor-directory-heading">
        <div>
          <p className="eyebrow dark"><span /> دفتر انتخاب ویلاوان</p>
          <h2>متخصصان منتخب</h2>
        </div>
        <div className="contractor-directory-count"><strong>{loading ? "—" : items.length.toLocaleString("fa-IR")}</strong><span>پروفایل منتشرشده</span></div>
        <p>هر پروفایل شامل حوزه تخصص، خدمات قابل درخواست و کاتالوگ قیمت‌های راهنماست. ادعاهای تأییدنشده، امتیاز ساختگی یا قیمت قطعی نمایش داده نمی‌شود.</p>
      </header>

      {loading ? <ContractorLoading /> : error ? <ErrorState className="market-state market-state-error" title="دریافت متخصصان انجام نشد" message={error} retryLabel="تلاش دوباره" onRetry={() => void load()} /> : items.length === 0 ? <EmptyState className="market-state" title="هنوز پروفایل منتشرشده‌ای وجود ندارد" message="اگر پروژه‌ای در دست دارید، کانسیرج ویلاوان می‌تواند درخواست شما را ثبت کند." action={<Link className="text-link" href="/support">گفت‌وگو با کانسیرج <span>←</span></Link>} /> : <div className="contractor-showcase-list">{items.map((item, index) => <ContractorShowcase key={item.slug} item={item} index={index} />)}</div>}
    </section>

    <section className="contractor-concierge-band">
      <div className="section-shell">
        <div><p className="eyebrow"><span /> هنوز مطمئن نیستید؟</p><h2>پروژه را تعریف کنید؛<br />ما مسیر معرفی را کوتاه می‌کنیم.</h2></div>
        <p>شهر، حدود متراژ و نوع کار را برای ما بنویسید. تیم ویلاوان درخواست را بررسی می‌کند و برای هماهنگی مرحله بعد تماس می‌گیرد.</p>
        <Link href="/support">شروع گفت‌وگو <span aria-hidden="true">←</span></Link>
      </div>
    </section>
    <PublicFooter />
  </main>;
}
