"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchVillaAvailability, type ApiAvailabilityDay } from "../lib/api";
import { formatShamsiDate } from "./ShamsiDateField";

function addDays(iso: string, amount: number) {
  const value = new Date(`${iso}T12:00:00`);
  value.setDate(value.getDate() + amount);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function todayIso() {
  const value = new Date();
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

export function AvailabilityCalendar({ slug, days = 42 }: { slug: string; days?: number }) {
  const start = useMemo(todayIso, []);
  const end = useMemo(() => addDays(start, days), [start, days]);
  const [items, setItems] = useState<ApiAvailabilityDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    fetchVillaAvailability(slug, start, end).then((result) => { if (active && result) setItems(result); }).catch(() => { if (active) setFailed(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug, start, end]);

  const statusByDate = useMemo(() => new Map(items.map((item) => [item.date, item])), [items]);
  const dates = useMemo(() => Array.from({ length: days }, (_, index) => addDays(start, index)), [start, days]);
  const availableCount = failed ? 0 : items.filter((item) => item.status === "open").length;

  return <section className="availability-calendar" aria-label="تقویم دسترسی اقامتگاه">
    <div className="availability-calendar-head"><div><p className="eyebrow">برنامه دسترسی</p><h2>روزهای قابل رزرو</h2><p>{failed ? "دریافت وضعیت ممکن نیست؛ لطفاً بعداً دوباره تلاش کنید." : "روزهای بسته یا رزروشده قابل انتخاب نیستند."}</p></div><strong>{loading ? "در حال بررسی…" : failed ? "وضعیت نامشخص" : `${availableCount.toLocaleString("fa-IR")} روز آزاد`}</strong></div>
    <div className="availability-legend"><span><i className="open" />آزاد</span><span><i className="blocked" />بسته</span><span><i className="booked" />رزروشده</span></div>
    <div className={`availability-days ${loading || failed ? "is-loading" : ""}`}>{dates.map((day) => {
      const status = loading || failed ? "blocked" : (statusByDate.get(day)?.status ?? "open");
      const shamsi = formatShamsiDate(day).split("/");
      return <div className={`availability-day ${status}`} key={day}><small>{shamsi[1] ? `${shamsi[1]}/${shamsi[2]}` : "—"}</small><b>{shamsi[2] ?? "—"}</b><span>{loading ? "در حال بررسی" : failed ? "نامشخص" : status === "open" ? "آزاد" : status === "blocked" ? "بسته" : "رزرو"}</span></div>;
    })}</div>
  </section>;
}
