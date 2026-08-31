"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BrandMark } from "../components/BrandLogo";
import { InnerHeader } from "../components/InnerHeader";
import { PublicSelect } from "../components/PublicSelect";
import { PublicFooter } from "../components/PublicFooter";
import { ShamsiDateField } from "../components/ShamsiDateField";
import { Button } from "../components/ui/Button";
import { EmptyState, ErrorState } from "../components/ui/Feedback";
import type { VillaListing } from "../types/villa";
import { fetchCities, fetchFavoriteVillas, fetchVillas, hasAuthenticatedSession, toggleVillaFavorite } from "../lib/api";
import styles from "./Villas.module.css";

const ALL_CITIES = "همه شهرها";

function dateFromToday(offset: number) {
  const value = new Date();
  value.setDate(value.getDate() + offset);
  return value.toISOString().slice(0, 10);
}

function CatalogSkeleton() {
  return <div className="villa-catalog-skeleton" aria-busy="true" aria-label="در حال دریافت ویلاها">
    {Array.from({ length: 6 }).map((_, index) => <div key={index}><i /><span /><span /><b /></div>)}
  </div>;
}

function VillaImage({ villa }: { villa: VillaListing }) {
  if (villa.image) return <img src={villa.image} alt={`${villa.title} در ${villa.city}`} loading="lazy" />;
  return <span className="villa-image-fallback"><BrandMark /><small>تصویر این اقامتگاه به‌زودی تکمیل می‌شود</small></span>;
}

export default function VillasPage() {
  const searchParams = useSearchParams();
  const initialCheckin = searchParams.get("checkin") || dateFromToday(1);
  const initialCheckout = searchParams.get("checkout") || dateFromToday(3);
  const initialCity = searchParams.get("city") || ALL_CITIES;
  const initialGuests = searchParams.get("guests") || "2";
  const requestedService = searchParams.get("service") || "";
  const [city, setCity] = useState(initialCity);
  const [checkin, setCheckin] = useState(initialCheckin);
  const [checkout, setCheckout] = useState(initialCheckout);
  const [guests, setGuests] = useState(initialGuests);
  const [appliedSearch, setAppliedSearch] = useState({ city: initialCity, checkin: initialCheckin, checkout: initialCheckout, guests: initialGuests });
  const [searchError, setSearchError] = useState("");
  const [poolOnly, setPoolOnly] = useState(false);
  const [instantOnly, setInstantOnly] = useState(false);
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(25);
  const [jacuzziOnly, setJacuzziOnly] = useState(false);
  const [forestOnly, setForestOnly] = useState(false);
  const [mountainOnly, setMountainOnly] = useState(false);
  const [sort, setSort] = useState("recommended");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [allVillas, setAllVillas] = useState<VillaListing[]>([]);
  const [cities, setCities] = useState<string[]>([ALL_CITIES]);
  const [dataSource, setDataSource] = useState<"loading" | "ready" | "error">("loading");
  const [requestRevision, setRequestRevision] = useState(0);
  const tripQuery = new URLSearchParams({ checkin: appliedSearch.checkin, checkout: appliedSearch.checkout, guests: appliedSearch.guests, ...(requestedService ? { services: requestedService } : {}) }).toString();
  const activeFilterCount = [poolOnly, instantOnly, jacuzziOnly, forestOnly, mountainOnly, minPrice !== 0, maxPrice !== 25].filter(Boolean).length;

  useEffect(() => {
    let active = true;
    setDataSource("loading");
    fetchVillas({
      city: appliedSearch.city === ALL_CITIES ? undefined : appliedSearch.city,
      checkin: appliedSearch.checkin,
      checkout: appliedSearch.checkout,
      guests: appliedSearch.guests,
    }).then((items) => {
      if (!active) return;
      if (items === null) setDataSource("error");
      else { setAllVillas(items); setDataSource("ready"); }
    }).catch(() => { if (active) setDataSource("error"); });
    return () => { active = false; };
  }, [appliedSearch, requestRevision]);

  useEffect(() => {
    void fetchCities().then((rows) => { if (rows) setCities([ALL_CITIES, ...rows.map((row) => row.name)]); }).catch(() => undefined);
    if (!hasAuthenticatedSession()) return;
    void fetchFavoriteVillas().then((items) => { if (items) setFavorites(items.map((item) => item.slug)); }).catch(() => undefined);
  }, []);

  const results = useMemo(() => {
    const filtered = allVillas.filter((villa) => {
      if (villa.price < minPrice * 1_000_000 || villa.price > maxPrice * 1_000_000) return false;
      if (poolOnly && !villa.pool) return false;
      if (instantOnly && !villa.instant) return false;
      if (jacuzziOnly && !villa.tags.some((tag) => tag.includes("جکوزی") || tag.includes("آب‌گرم"))) return false;
      if (forestOnly && !`${villa.setting} ${villa.tags.join(" ")}`.includes("جنگل")) return false;
      if (mountainOnly && !`${villa.setting} ${villa.tags.join(" ")}`.includes("کوه")) return false;
      return true;
    });
    return [...filtered].sort((a, b) => {
      if (sort === "low") return a.price - b.price;
      if (sort === "high") return b.price - a.price;
      return Number(b.reviews > 0) - Number(a.reviews > 0) || b.reviews - a.reviews;
    });
  }, [allVillas, forestOnly, instantOnly, jacuzziOnly, maxPrice, minPrice, mountainOnly, poolOnly, sort]);

  function runSearch(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!checkin || !checkout) { setSearchError("لطفاً تاریخ ورود و خروج را انتخاب کنید."); return; }
    const today = dateFromToday(0);
    const nights = Math.round((new Date(`${checkout}T12:00:00`).getTime() - new Date(`${checkin}T12:00:00`).getTime()) / 86_400_000);
    if (checkin < today) { setSearchError("تاریخ ورود نمی‌تواند گذشته باشد."); return; }
    if (checkout <= checkin) { setSearchError("تاریخ خروج باید بعد از تاریخ ورود باشد."); return; }
    if (nights < 2) { setSearchError("حداقل مدت اقامت دو شب است."); return; }
    if (Number(guests) < 1) { setSearchError("تعداد مهمانان را انتخاب کنید."); return; }
    setSearchError("");
    const next = { city, checkin, checkout, guests };
    setAppliedSearch(next);
    const query = new URLSearchParams({ checkin, checkout, guests });
    if (city !== ALL_CITIES) query.set("city", city);
    window.history.replaceState({}, "", `/villas?${query.toString()}`);
  }

  function clearFilters() {
    setPoolOnly(false); setInstantOnly(false); setJacuzziOnly(false); setForestOnly(false); setMountainOnly(false); setMinPrice(0); setMaxPrice(25);
  }

  async function toggleFavorite(slug: string) {
    if (!hasAuthenticatedSession()) {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
      return;
    }
    const wasSaved = favorites.includes(slug);
    setFavorites((current) => wasSaved ? current.filter((item) => item !== slug) : [...current, slug]);
    try {
      const result = await toggleVillaFavorite(slug);
      if (result && result.saved !== !wasSaved) setFavorites((current) => result.saved ? [...new Set([...current, slug])] : current.filter((item) => item !== slug));
    } catch {
      setFavorites((current) => wasSaved ? [...new Set([...current, slug])] : current.filter((item) => item !== slug));
    }
  }

  return <main id="main-content" tabIndex={-1} dir="rtl" className={`inner-page villas-luxury-page ${styles.page}`}>
    <InnerHeader />

    <section className="villa-catalog-hero">
      <div className="section-shell">
        <div className="villa-catalog-copy">
          <p className="eyebrow dark"><span /> اقامتگاه‌های منتخب مازندران</p>
          <h1>جایی که اقامت،<br /><em>بخشی از سفر می‌شود.</em></h1>
          <p>ویلاهای منتشرشده با اطلاعات واقعی، قیمت شفاف و برنامه دسترسی قابل بررسی.</p>
          <div className="catalog-trust-line"><span>✓ بررسی محتوای اقامتگاه</span><span>◌ پشتیبانی رزرو</span><span>◇ پرداخت امن کارت‌به‌کارت</span></div>
        </div>
        <div className="catalog-hero-art" aria-hidden="true"><BrandMark /><span>VILLAONE</span><small>اقامتگاه‌های منتشرشده مازندران</small></div>
      </div>
    </section>

    <form className="catalog-search-shell section-shell" aria-label="جست‌وجوی ویلا" onSubmit={runSearch}>
      <div className="catalog-search-panel">
        <PublicSelect className="catalog-select-field" label="مقصد" value={city} onChange={setCity} options={cities.map((item) => ({ value: item, label: item }))} />
        <ShamsiDateField value={checkin} minValue={dateFromToday(0)} onChange={setCheckin} label="ورود" />
        <ShamsiDateField value={checkout} minValue={checkin} onChange={setCheckout} label="خروج" />
        <PublicSelect className="catalog-select-field" label="مهمان" value={guests} onChange={setGuests} options={[2, 4, 6, 8, 10, 12].map((count) => ({ value: String(count), label: `${count.toLocaleString("fa-IR")} نفر` }))} />
        <button type="submit"><span>جست‌وجوی اقامتگاه</span><b aria-hidden="true">←</b></button>
      </div>
      {searchError && <p className="search-form-error" role="alert">{searchError}</p>}
    </form>

    <section className="luxury-catalog-layout section-shell">
      <div className="catalog-topbar">
        <div><small>اقامتگاه‌های قابل رزرو</small><h2>{dataSource === "ready" ? `${results.length.toLocaleString("fa-IR")} انتخاب برای سفر شما` : "در حال بررسی انتخاب‌ها"}</h2></div>
        <div className="catalog-topbar-actions">
          <button className="mobile-filter-button" type="button" onClick={() => setFiltersOpen((value) => !value)} aria-expanded={filtersOpen}>فیلترها {activeFilterCount > 0 && <span>{activeFilterCount.toLocaleString("fa-IR")}</span>}</button>
          <PublicSelect className="catalog-sort-select" label="مرتب‌سازی" value={sort} onChange={setSort} options={[{ value: "recommended", label: "پیشنهاد ویلاوان" }, { value: "low", label: "کمترین قیمت" }, { value: "high", label: "بیشترین قیمت" }]} />
        </div>
      </div>

      <div className="catalog-content-grid">
        <aside className={filtersOpen ? "luxury-filter-panel is-open" : "luxury-filter-panel"}>
          <div><h3>فیلتر انتخاب‌ها</h3><button type="button" onClick={clearFilters}>پاک کردن</button></div>
          <fieldset><legend>بودجه هر شب</legend><div className="luxury-price-inputs"><label><span>از (میلیون)</span><input type="number" min="0" max={maxPrice} value={minPrice} onChange={(event) => setMinPrice(Math.max(0, Math.min(Number(event.target.value) || 0, maxPrice)))} /></label><label><span>تا (میلیون)</span><input type="number" min={minPrice} max="100" value={maxPrice} onChange={(event) => setMaxPrice(Math.max(minPrice, Number(event.target.value) || minPrice))} /></label></div></fieldset>
          <fieldset><legend>نوع رزرو</legend><label className="luxury-check"><input type="checkbox" checked={instantOnly} onChange={(event) => setInstantOnly(event.target.checked)} /><span><b>رزرو آنی</b><small>بدون انتظار برای تأیید میزبان</small></span></label></fieldset>
          <fieldset><legend>امکانات و فضا</legend><label className="luxury-check"><input type="checkbox" checked={poolOnly} onChange={(event) => setPoolOnly(event.target.checked)} /><span><b>استخر اختصاصی</b></span></label><label className="luxury-check"><input type="checkbox" checked={jacuzziOnly} onChange={(event) => setJacuzziOnly(event.target.checked)} /><span><b>جکوزی یا آب‌گرم</b></span></label><label className="luxury-check"><input type="checkbox" checked={forestOnly} onChange={(event) => setForestOnly(event.target.checked)} /><span><b>فضای جنگلی</b></span></label><label className="luxury-check"><input type="checkbox" checked={mountainOnly} onChange={(event) => setMountainOnly(event.target.checked)} /><span><b>چشم‌انداز کوهستان</b></span></label></fieldset>
          <Link className="filter-map-link" href="/map"><span>◎</span><div><b>انتخاب روی نقشه</b><small>موقعیت تقریبی همه ویلاها</small></div><i>←</i></Link>
        </aside>

        <div className="catalog-results" aria-live="polite">
          {dataSource === "loading" && <CatalogSkeleton />}
          {dataSource === "error" && <ErrorState className="catalog-error-state" title="دریافت ویلاها ممکن نشد" message="اتصال با سرور برقرار نشد. دوباره تلاش کنید؛ اطلاعات غیرواقعی جایگزین نمی‌شود." onRetry={() => setRequestRevision((value) => value + 1)} />}
          {dataSource === "ready" && results.length === 0 && <EmptyState className="catalog-empty-state" title="ویلایی با این انتخاب‌ها پیدا نشد" message="محدوده قیمت یا فیلتر امکانات را بازتر کنید." action={<Button variant="secondary" size="sm" onClick={clearFilters}>نمایش همه انتخاب‌ها</Button>} />}
          {dataSource === "ready" && results.length > 0 && <div className="luxury-villa-grid">{results.map((villa) => {
            const selected = favorites.includes(villa.slug);
            const galleryCount = Math.max(villa.gallery.length, villa.image ? 1 : 0);
            return <article className="luxury-villa-card" key={villa.slug}>
              <Link className="luxury-villa-media" href={`/villas/${villa.slug}?${tripQuery}`}><VillaImage villa={villa} />{villa.badge && <span className="luxury-villa-badge">{villa.badge}</span>}{galleryCount > 1 && <small>▦ {galleryCount.toLocaleString("fa-IR")} تصویر</small>}</Link>
              <button className={selected ? "luxury-favorite is-selected" : "luxury-favorite"} type="button" onClick={() => toggleFavorite(villa.slug)} aria-label={selected ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"} aria-pressed={selected}>{selected ? "♥" : "♡"}</button>
              <div className="luxury-villa-body"><div className="luxury-villa-overline"><span>{villa.city}</span><i />{villa.setting}</div><Link href={`/villas/${villa.slug}?${tripQuery}`}><h3>{villa.title}</h3></Link><p>{villa.guests.toLocaleString("fa-IR")} مهمان · {villa.rooms.toLocaleString("fa-IR")} اتاق خواب{villa.tags[0] ? ` · ${villa.tags[0]}` : ""}</p><div className="luxury-villa-footer"><div><strong>{villa.priceLabel}</strong><span> تومان / شب</span></div><span className="villa-rating-truth">{villa.reviews ? `★ ${villa.rating} · ${villa.reviews.toLocaleString("fa-IR")} نظر` : "اقامتگاه جدید"}</span></div></div>
            </article>;
          })}</div>}
        </div>
      </div>
    </section>

    <section className="catalog-map-cta section-shell"><div><span>◎</span><div><small>دید متفاوت</small><h2>ویلاها را روی نقشه مازندران ببینید</h2><p>شهر، فاصله و موقعیت تقریبی اقامتگاه‌ها را یک‌جا مقایسه کنید.</p></div></div><Link href="/map">باز کردن نقشه <b>←</b></Link></section>
    <PublicFooter />
  </main>;
}
