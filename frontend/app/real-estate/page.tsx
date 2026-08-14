"use client";

import { useEffect, useState } from "react";
import { InnerHeader } from "../components/InnerHeader";
import { type RealEstateListing, fetchRealEstateListings } from "../lib/api";

const money = (value: string) => Number(value).toLocaleString("fa-IR");

export default function RealEstatePage() {
  const [items, setItems] = useState<RealEstateListing[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { void fetchRealEstateListings().then((data) => setItems(data ?? [])).finally(() => setLoading(false)); }, []);
  return <main dir="rtl" className="inner-page market-page"><InnerHeader /><section className="market-hero"><div className="section-shell"><p className="eyebrow"><span /> انتخاب آگاهانه در شمال</p><h1>ملک‌های منتخب<br />ویلاوان</h1><p>فهرستی محدود برای خرید یا سرمایه‌گذاری؛ درخواست شما ثبت می‌شود و ادامه بررسی، بازدید و استعلام به‌صورت تلفنی و حضوری انجام می‌گیرد.</p></div></section><section className="market-list section-shell"><div className="market-heading"><div><p className="eyebrow dark"><span /> املاک</p><h2>فرصت‌های فعلی</h2></div><p>ویلاوان فروشنده مستقیم نیست؛ نقش ما معرفی اولیه و هماهنگی مسیر بررسی با متخصصان محلی است.</p></div>{loading ? <div className="market-empty">در حال دریافت فایل‌ها…</div> : items.length ? <div className="property-grid">{items.map((item) => <article key={item.slug}><a className="market-image" href={`/real-estate/${item.slug}`}><img src={item.cover_image} alt={item.title} />{item.is_featured && <span>منتخب ویلاوان</span>}</a><div><small>{item.city} · {item.neighborhood}</small><h2><a href={`/real-estate/${item.slug}`}>{item.title}</a></h2><p>{item.area_m2.toLocaleString("fa-IR")} متر · {item.bedrooms ? `${item.bedrooms.toLocaleString("fa-IR")} خواب` : "زمین"}</p><footer><strong>{money(item.price)} تومان</strong><a href={`/real-estate/${item.slug}`}>جزئیات ←</a></footer></div></article>)}</div> : <div className="market-empty">در حال حاضر فایل منتشرشده‌ای وجود ندارد.</div>}</section></main>;
}
