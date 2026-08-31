/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { InnerHeader } from "../components/InnerHeader";
import { PublicFooter } from "../components/PublicFooter";
import { EmptyState, ErrorState } from "../components/ui/Feedback";
import { type RealEstateListing, fetchRealEstateListings } from "../lib/api";
import styles from "./RealEstate.module.css";

type CatalogueState = "loading" | "ready" | "error";

const money = (value: string) => Number(value).toLocaleString("fa-IR");
const propertyType = (value: RealEstateListing["property_type"]) => value === "land" ? "زمین" : value === "apartment" ? "آپارتمان" : "ویلا";

function PropertyCard({ item }: { item: RealEstateListing }) {
  return (
    <article className={`${styles.propertyCard} ${item.is_featured ? styles.featuredCard : ""}`}>
      <Link className={styles.cardMedia} href={`/real-estate/${item.slug}`} aria-label={`مشاهده ${item.title}`}>
        {item.cover_image ? <img src={item.cover_image} alt={item.title} loading="lazy" /> : <span className={styles.imageFallback}>ویلاوان</span>}
        <span className={styles.cardType}>{propertyType(item.property_type)}</span>
        {item.is_featured && <span className={styles.featuredBadge}>منتخب ویلاوان</span>}
      </Link>
      <div className={styles.cardBody}>
        <div className={styles.cardLocation}><span>مازندران</span><i aria-hidden="true" />{item.city}{item.neighborhood ? `، ${item.neighborhood}` : ""}</div>
        <h2><Link href={`/real-estate/${item.slug}`}>{item.title}</Link></h2>
        <dl className={styles.cardFacts}>
          <div><dt>مساحت</dt><dd>{item.area_m2.toLocaleString("fa-IR")} متر</dd></div>
          <div><dt>خواب</dt><dd>{item.bedrooms ? item.bedrooms.toLocaleString("fa-IR") : "—"}</dd></div>
        </dl>
        <footer className={styles.cardFooter}>
          <div><small>قیمت اعلامی</small><strong>{money(item.price)} <span>تومان</span></strong></div>
          <Link href={`/real-estate/${item.slug}`}>بررسی فایل <span aria-hidden="true">←</span></Link>
        </footer>
      </div>
    </article>
  );
}

function CatalogueSkeleton() {
  return <div className={styles.propertyGrid} aria-label="در حال دریافت فایل‌های ملکی" aria-busy="true">{[0, 1, 2].map((item) => <div className={styles.skeletonCard} key={item}><span /><div><i /><i /><i /></div></div>)}</div>;
}

export default function RealEstatePage() {
  const [items, setItems] = useState<RealEstateListing[]>([]);
  const [state, setState] = useState<CatalogueState>("loading");

  const loadListings = useCallback(async () => {
    setState("loading");
    try {
      const listings = await fetchRealEstateListings();
      if (listings === null) throw new Error("Real-estate API is not configured");
      setItems(listings);
      setState("ready");
    } catch {
      setItems([]);
      setState("error");
    }
  }, []);

  useEffect(() => { void loadListings(); }, [loadListings]);

  return (
    <main dir="rtl" className={`${styles.page} inner-page`}>
      <InnerHeader />
      <section className={styles.hero}>
        <img src="/images/editorial/property-editorial.webp" alt="ویلایی مدرن در طبیعت شمال" width="1440" height="810" fetchPriority="high" />
        <div className={styles.heroShade} aria-hidden="true" />
        <div className={`${styles.heroInner} section-shell`}>
          <p className="eyebrow"><span /> انتخاب آگاهانه در شمال</p>
          <h1>فایل‌های محدود،<br /><em>بررسی دقیق.</em></h1>
          <p>مجموعه‌ای گزیده برای خرید یا سرمایه‌گذاری؛ با هماهنگی بازدید، گفت‌وگو با متخصص محلی و فرصت کافی برای استعلام رسمی.</p>
          <Link href="#current-properties" className={styles.heroLink}>مشاهده فرصت‌های فعلی <span aria-hidden="true">↓</span></Link>
        </div>
        <div className={styles.trustRail}>
          <div className="section-shell"><span>۰۱</span><p><strong>معرفی اولیه</strong>بدون ادعای فروش مستقیم</p><span>۰۲</span><p><strong>هماهنگی بازدید</strong>متناسب با زمان شما</p><span>۰۳</span><p><strong>بررسی مستقل</strong>پیش از هر تصمیم یا پرداخت</p></div>
        </div>
      </section>

      <section id="current-properties" className={`${styles.catalogue} section-shell`}>
        <header className={styles.sectionHeading}>
          <div><p className="eyebrow dark"><span /> املاک ویلاوان</p><h2>فرصت‌های فعلی</h2></div>
          <div className={styles.sectionIntro}><p>ویلاوان فروشنده مستقیم نیست؛ نقش ما معرفی اولیه و هماهنگی مسیر بررسی با متخصصان محلی است.</p>{state === "ready" && <span>{items.length.toLocaleString("fa-IR")} فایل منتشرشده</span>}</div>
        </header>

        {/* ErrorState renders role="alert" and keeps retry feedback accessible. */}
        {state === "loading" ? <CatalogueSkeleton /> : state === "error" ? (
          <ErrorState className={styles.statePanel} title="دریافت فایل‌ها ممکن نشد" message="ارتباط با سرور برقرار نیست. اطلاعات نادرست یا جایگزین نمایش داده نمی‌شود." retryLabel="تلاش دوباره" onRetry={() => void loadListings()} />
        ) : items.length === 0 ? (
          <EmptyState className={styles.statePanel} title="فعلاً فایل منتشرشده‌ای نداریم" message="فقط ملک‌هایی که برای معرفی آماده شده‌اند در این بخش دیده می‌شوند." action={<Link href="/support">گفت‌وگو با ویلاوان</Link>} />
        ) : <div className={styles.propertyGrid}>{items.map((item) => <PropertyCard item={item} key={item.slug} />)}</div>}
      </section>

      <section className={styles.conciergeNote}><div className="section-shell"><p className="eyebrow"><span /> همراهی انسانی</p><h2>یک فایل خوب، شروع بررسی است؛ نه پایان آن.</h2><p>برای هر درخواست، تیم ویلاوان مسیر بازدید و ارتباط با متخصص محلی را هماهنگ می‌کند. تصمیم حقوقی و مالی پس از استعلام مستقل شما انجام می‌شود.</p><Link href="/support">درخواست راهنمایی <span aria-hidden="true">←</span></Link></div></section>
      <PublicFooter />
    </main>
  );
}
