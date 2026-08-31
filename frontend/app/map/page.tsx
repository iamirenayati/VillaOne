"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BrandMark } from "../components/BrandLogo";
import { InnerHeader } from "../components/InnerHeader";
import { PublicSelect } from "../components/PublicSelect";
import { fetchMapVillas, type MapVilla } from "../lib/api";
import { PracticalMap } from "./PracticalMap";
import { settingLabel, toman } from "./map-utils";

type LoadState = "loading" | "ready" | "error";

function VillaImage({ villa }: { villa: MapVilla }) {
  return villa.cover_image
    ? <img src={villa.cover_image} alt="" />
    : <span className="map-villa-image-fallback"><BrandMark /></span>;
}

function ActiveVillaCard({ villa }: { villa: MapVilla }) {
  return (
    <article className="map-active-villa" aria-live="polite">
      <div className="map-active-villa-image"><VillaImage villa={villa} /><span>موقعیت تقریبی</span></div>
      <div className="map-active-villa-copy">
        <p>{villa.city.name} <i /> ظرفیت {villa.capacity.toLocaleString("fa-IR")} مهمان</p>
        <h2>{villa.title}</h2>
        <small>{settingLabel(villa.setting_tags) || "اقامت در طبیعت مازندران"}</small>
        <footer>
          <strong>{toman(villa.price_weekday)} <small>تومان / شب</small></strong>
          <a href={`/villas/${villa.slug}`}>مشاهده ویلا <span aria-hidden="true">←</span></a>
        </footer>
      </div>
    </article>
  );
}

export default function MazandaranMapPage() {
  const [villas, setVillas] = useState<MapVilla[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [activeSlug, setActiveSlug] = useState("");
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("all");
  const [fitRequest, setFitRequest] = useState(0);

  const load = useCallback(() => {
    setState("loading");
    void fetchMapVillas().then((items) => {
      const rows = items ?? [];
      setVillas(rows);
      setActiveSlug((current) => rows.some((item) => item.slug === current) ? current : rows[0]?.slug ?? "");
      setState("ready");
    }).catch(() => setState("error"));
  }, []);

  useEffect(load, [load]);

  const cities = useMemo(() => [...new Set(villas.map((villa) => villa.city.name))].sort((a, b) => a.localeCompare(b, "fa")), [villas]);
  const filteredVillas = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("fa");
    return villas.filter((villa) => {
      const matchesCity = city === "all" || villa.city.name === city;
      const haystack = `${villa.title} ${villa.city.name} ${settingLabel(villa.setting_tags)}`.toLocaleLowerCase("fa");
      return matchesCity && (!needle || haystack.includes(needle));
    });
  }, [city, query, villas]);

  useEffect(() => {
    if (!filteredVillas.some((villa) => villa.slug === activeSlug)) setActiveSlug(filteredVillas[0]?.slug ?? "");
  }, [activeSlug, filteredVillas]);

  const activeVilla = filteredVillas.find((villa) => villa.slug === activeSlug) ?? filteredVillas[0] ?? null;
  const averagePrice = villas.length ? Math.round(villas.reduce((sum, villa) => sum + Number(villa.price_weekday), 0) / villas.length) : 0;
  const selectVilla = useCallback((slug: string) => setActiveSlug(slug), []);
  const clearFilters = () => { setQuery(""); setCity("all"); };

  return (
    <main dir="rtl" className="map-page map-practical-v4">
      <InnerHeader />
      <section className="map-practical-shell" aria-labelledby="map-title">
        <header className="map-practical-hero">
          <div>
            <p><span /> اطلس اقامت VillaOne</p>
            <h1 id="map-title">مازندران را روی نقشه کشف کنید</h1>
            <span>ویلاها را مقایسه کنید، محله مناسب را پیدا کنید و مستقیم وارد صفحه رزرو شوید.</span>
          </div>
          <dl className="map-stat-widgets">
            <div><dt>ویلا روی نقشه</dt><dd>{villas.length.toLocaleString("fa-IR")}</dd></div>
            <div><dt>شهر قابل انتخاب</dt><dd>{cities.length.toLocaleString("fa-IR")}</dd></div>
            <div><dt>میانگین هر شب</dt><dd>{averagePrice ? `${toman(String(averagePrice))} ت` : "—"}</dd></div>
          </dl>
        </header>

        <div className="map-filter-bar" role="search">
          <label className="map-search-field">
            <span aria-hidden="true">⌕</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="نام ویلا، شهر یا نوع اقامت" aria-label="جست‌وجوی ویلا روی نقشه" />
          </label>
          <PublicSelect className="map-city-filter" label="مقصد" value={city} onChange={setCity} options={[{ value: "all", label: "همه شهرها" }, ...cities.map((name) => ({ value: name, label: name }))]} />
          <button type="button" className="map-fit-button" onClick={() => setFitRequest((value) => value + 1)} disabled={filteredVillas.length === 0}>
            <span aria-hidden="true">◎</span> نمایش همه روی نقشه
          </button>
        </div>

        {state === "loading" && (
          <div className="map-page-state map-is-loading" role="status" aria-live="polite"><i /><strong>در حال دریافت ویلاها و آماده‌سازی نقشه…</strong></div>
        )}
        {state === "error" && (
          <div className="map-page-state" role="alert" aria-live="polite"><strong>ارتباط با سرور برقرار نشد</strong><p>اطلاعات ساختگی نمایش داده نمی‌شود. لطفاً دوباره تلاش کنید.</p><button type="button" onClick={load}>تلاش دوباره</button></div>
        )}
        {state === "ready" && villas.length === 0 && (
          <div className="map-page-state" role="status" aria-live="polite"><strong>هنوز ویلایی روی نقشه منتشر نشده است</strong><p>پس از افزودن موقعیت تقریبی در مدیریت، ویلاها اینجا دیده می‌شوند.</p><a href="/villas">مشاهده فهرست ویلاها</a></div>
        )}

        {state === "ready" && villas.length > 0 && (
          <div className="map-workspace">
            <div className="map-stage">
              <PracticalMap villas={filteredVillas} activeSlug={activeVilla?.slug ?? ""} fitRequest={fitRequest} onSelect={selectVilla} />
              <div className="map-privacy-chip"><i /> موقعیت تقریبی برای حفظ حریم خصوصی</div>
              {activeVilla && <ActiveVillaCard villa={activeVilla} />}
            </div>

            <aside className="map-villa-panel" aria-label="ویلاهای روی نقشه">
              <header><div><strong>{filteredVillas.length.toLocaleString("fa-IR")} انتخاب</strong><span>روی نقشه مازندران</span></div><span className="map-live-badge"><i /> زنده</span></header>
              {filteredVillas.length === 0 ? (
                <div className="map-filter-empty"><strong>نتیجه‌ای پیدا نشد</strong><span>عبارت یا مقصد دیگری را امتحان کنید.</span><button type="button" onClick={clearFilters}>پاک‌کردن فیلترها</button></div>
              ) : (
                <div className="map-villa-list">
                  {filteredVillas.map((villa) => (
                    <button key={villa.slug} type="button" className={villa.slug === activeVilla?.slug ? "is-active" : ""} onClick={() => selectVilla(villa.slug)} aria-pressed={villa.slug === activeVilla?.slug}>
                      <span className="map-list-image"><VillaImage villa={villa} />{villa.featured && <em>منتخب</em>}</span>
                      <span className="map-list-copy"><small>{villa.city.name} · موقعیت تقریبی</small><strong>{villa.title}</strong><span>{villa.capacity.toLocaleString("fa-IR")} مهمان · {settingLabel(villa.setting_tags) || "اقامتگاه"}</span><b>{toman(villa.price_weekday)} <small>تومان / شب</small></b></span>
                    </button>
                  ))}
                </div>
              )}
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}
