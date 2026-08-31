/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { InnerHeader } from "../../components/InnerHeader";
import { InquiryForm } from "../../components/InquiryForm";
import { PublicFooter } from "../../components/PublicFooter";
import { ErrorState } from "../../components/ui/Feedback";
import { type RealEstateListing, fetchRealEstateListing } from "../../lib/api";
import styles from "../RealEstate.module.css";

type DetailState = "loading" | "ready" | "error";
const propertyType = (value: RealEstateListing["property_type"]) => value === "land" ? "زمین" : value === "apartment" ? "آپارتمان" : "ویلا";

export default function RealEstateDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [item, setItem] = useState<RealEstateListing | null>(null);
  const [state, setState] = useState<DetailState>("loading");

  const loadListing = useCallback(async () => {
    setState("loading");
    try {
      const listing = await fetchRealEstateListing(slug);
      setItem(listing);
      setState(listing ? "ready" : "error");
    } catch {
      setItem(null);
      setState("error");
    }
  }, [slug]);

  useEffect(() => { void loadListing(); }, [loadListing]);

  return (
    <main dir="rtl" className={`${styles.page} ${styles.detailPage} inner-page`}>
      <InnerHeader />
      {/* ErrorState renders role="alert" for a truthful recovery state. */}
      {state === "loading" ? (
        <div className={`${styles.detailLoading} section-shell`} aria-busy="true" aria-label="در حال دریافت اطلاعات ملک"><span /><i /><i /></div>
      ) : state === "error" || !item ? (
        <ErrorState className={`${styles.statePanel} ${styles.detailState} section-shell`} title="این فایل در دسترس نیست" message="ممکن است فایل از انتشار خارج شده باشد یا ارتباط با سرور برقرار نباشد." retryLabel="تلاش دوباره" onRetry={() => void loadListing()} action={<Link href="/real-estate">بازگشت به املاک</Link>} />
      ) : (
        <>
          <section className={styles.detailHero}>
            {item.cover_image ? <img src={item.cover_image} alt={item.title} /> : <div className={styles.detailImageFallback}>ویلاوان</div>}
            <div className={styles.detailShade} aria-hidden="true" />
            <div className={`${styles.detailHeroInner} section-shell`}>
              <nav aria-label="مسیر صفحه"><Link href="/real-estate">املاک</Link><span>/</span><span>{item.city}</span></nav>
              <div className={styles.detailTitleRow}>
                <div><p>{propertyType(item.property_type)} · {item.city}{item.neighborhood ? `، ${item.neighborhood}` : ""}</p><h1>{item.title}</h1></div>
                <div className={styles.detailPrice}><small>قیمت اعلامی مالک</small><strong>{Number(item.price).toLocaleString("fa-IR")}</strong><span>تومان</span></div>
              </div>
            </div>
          </section>

          <div className={`${styles.detailLayout} section-shell`}>
            <article className={styles.detailCopy}>
              <section className={styles.introSection}>
                <p className="eyebrow dark"><span /> معرفی ملک</p>
                <h2>اطلاعات روشن،<br />برای بررسی دقیق‌تر.</h2>
                <p>{item.description}</p>
              </section>

              <dl className={styles.detailFacts}>
                <div><dt>مساحت</dt><dd>{item.area_m2.toLocaleString("fa-IR")} <span>متر مربع</span></dd></div>
                <div><dt>نوع ملک</dt><dd>{propertyType(item.property_type)}</dd></div>
                <div><dt>اتاق خواب</dt><dd>{item.bedrooms ? item.bedrooms.toLocaleString("fa-IR") : "—"}</dd></div>
                <div><dt>محدوده</dt><dd>{item.neighborhood || item.city}</dd></div>
              </dl>

              {item.features.length > 0 && <section className={styles.featureSection}><div><p className="eyebrow dark"><span /> جزئیات</p><h2>ویژگی‌های ثبت‌شده</h2></div><ul>{item.features.map((feature) => <li key={feature}><span aria-hidden="true">✓</span>{feature}</li>)}</ul></section>}

              <section className={styles.reviewPath}><p className="eyebrow dark"><span /> مسیر بررسی</p><h2>پیش از تصمیم نهایی</h2><ol><li><span>۰۱</span><div><strong>گفت‌وگوی اولیه</strong><p>نیازها و پرسش‌های اصلی شما با تیم ویلاوان مرور می‌شود.</p></div></li><li><span>۰۲</span><div><strong>هماهنگی بازدید</strong><p>زمان بازدید و ارتباط با فرد محلی مسئول فایل هماهنگ می‌شود.</p></div></li><li><span>۰۳</span><div><strong>استعلام مستقل</strong><p>سند، کاربری، حدود و شرایط معامله را با متخصص منتخب خود بررسی می‌کنید.</p></div></li></ol></section>

              <div className={styles.disclaimer}><span aria-hidden="true">!</span><p><strong>یادآوری مهم</strong>اطلاعات این صفحه معرفی اولیه است. اصالت سند، کاربری، حدود و شرایط معامله باید پیش از هر پرداخت با استعلام رسمی بررسی شود.</p></div>
            </article>
            <aside className={styles.inquiryAside}><div className={styles.inquiryContext}><span>پاسخ‌گویی انسانی</span><p>پس از ثبت درخواست، تیم ویلاوان برای هماهنگی ادامه مسیر با شما تماس می‌گیرد.</p></div><InquiryForm kind="real_estate" targetSlug={item.slug} title={item.title} /></aside>
          </div>
        </>
      )}
      <PublicFooter />
    </main>
  );
}
