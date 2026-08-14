"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { InnerHeader } from "../../components/InnerHeader";
import { InquiryForm } from "../../components/InquiryForm";
import { type RealEstateListing, fetchRealEstateListing } from "../../lib/api";

export default function RealEstateDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [item, setItem] = useState<RealEstateListing | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { void fetchRealEstateListing(slug).then(setItem).catch(() => setError("این ملک پیدا نشد.") ); }, [slug]);
  return <main dir="rtl" className="inner-page market-detail"><InnerHeader />{error ? <div className="market-empty section-shell">{error}</div> : !item ? <div className="market-empty section-shell">در حال دریافت اطلاعات…</div> : <><section className="market-detail-hero"><img src={item.cover_image} alt={item.title} /><div><small>{item.city} · {item.neighborhood}</small><h1>{item.title}</h1><p><strong>{Number(item.price).toLocaleString("fa-IR")}</strong> تومان</p></div></section><div className="market-detail-layout section-shell"><article className="market-copy"><p className="eyebrow dark"><span /> معرفی ملک</p><h2>برای یک تصمیم روشن</h2><p>{item.description}</p><div className="market-facts"><div><span>مساحت</span><strong>{item.area_m2.toLocaleString("fa-IR")} متر</strong></div><div><span>نوع</span><strong>{item.property_type === "land" ? "زمین" : item.property_type === "apartment" ? "آپارتمان" : "ویلا"}</strong></div><div><span>اتاق خواب</span><strong>{item.bedrooms.toLocaleString("fa-IR")}</strong></div></div><h3>ویژگی‌ها</h3><ul>{item.features.map((feature) => <li key={feature}>✓ {feature}</li>)}</ul><div className="market-disclaimer">اطلاعات این صفحه معرفی اولیه است. اصالت سند، کاربری، حدود و شرایط معامله باید پیش از هر پرداخت با استعلام رسمی بررسی شود.</div></article><InquiryForm kind="real_estate" targetSlug={item.slug} title={item.title} /></div></>}</main>;
}
