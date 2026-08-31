"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const monthNames = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
const weekDays = ["ش", "ی", "د", "س", "چ", "پ", "ج"];
const div = (a: number, b: number) => Math.floor(a / b);
const faDigits = (value: string | number) => String(value).replace(/[0-9]/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);

export function gregorianToJalali(gy: number, gm: number, gd: number) {
  const gdm = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days = 355666 + 365 * gy + div(gy2 + 3, 4) - div(gy2 + 99, 100) + div(gy2 + 399, 400) + gd + gdm[gm - 1];
  let jy = -1595 + 33 * div(days, 12053);
  days %= 12053;
  jy += 4 * div(days, 1461);
  days %= 1461;
  if (days > 365) { jy += div(days - 1, 365); days = (days - 1) % 365; }
  const jm = days < 186 ? 1 + div(days, 31) : 7 + div(days - 186, 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return { year: jy, month: jm, day: jd };
}

export function jalaliToGregorian(jy: number, jm: number, jd: number) {
  jy += 1595;
  let days = -355668 + 365 * jy + div(jy / 33, 1) * 8 + div((jy % 33) + 3, 4) + jd + (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  let gy = 400 * div(days, 146097);
  days %= 146097;
  if (days > 36524) { gy += 100 * div(--days, 36524); days %= 36524; if (days >= 365) days++; }
  gy += 4 * div(days, 1461);
  days %= 1461;
  if (days > 365) { gy += div(days - 1, 365); days = (days - 1) % 365; }
  const gd = days + 1;
  const sal = [0, 31, (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 0;
  let remaining = gd;
  while (remaining > sal[gm + 1]) { remaining -= sal[gm + 1]; gm++; }
  return { year: gy, month: gm + 1, day: remaining };
}

const isoFromJalali = (year: number, month: number, day: number) => {
  const value = jalaliToGregorian(year, month, day);
  return `${value.year}-${String(value.month).padStart(2, "0")}-${String(value.day).padStart(2, "0")}`;
};

const isJalaliLeapYear = (year: number) => {
  const start = jalaliToGregorian(year, 1, 1);
  const next = jalaliToGregorian(year + 1, 1, 1);
  return Math.round((Date.UTC(next.year, next.month - 1, next.day) - Date.UTC(start.year, start.month - 1, start.day)) / 86400000) === 366;
};

const jalaliFromIso = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return year && month && day ? gregorianToJalali(year, month, day) : null;
};

export const formatShamsiDate = (value: string) => {
  const date = jalaliFromIso(value);
  return date ? `${faDigits(date.year)}/${faDigits(String(date.month).padStart(2, "0"))}/${faDigits(String(date.day).padStart(2, "0"))}` : "—";
};

export function ShamsiDateField({ value, minValue, onChange, label, className = "", disabledDates = [] }: { value: string; minValue?: string; onChange: (value: string) => void; label: string; className?: string; disabledDates?: string[] }) {
  const today = new Date();
  const initial = jalaliFromIso(value) ?? gregorianToJalali(today.getFullYear(), today.getMonth() + 1, today.getDate());
  const [open, setOpen] = useState(false);
  const fieldRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ year: initial.year, month: initial.month });
  const selected = jalaliFromIso(value);
  const min = minValue ? new Date(`${minValue}T12:00:00`).getTime() : null;
  const daysInMonth = view.month <= 6 ? 31 : view.month <= 11 ? 30 : isJalaliLeapYear(view.year) ? 30 : 29;
  const firstIso = isoFromJalali(view.year, view.month, 1);
  const firstDay = (new Date(`${firstIso}T12:00:00`).getDay() + 1) % 7;
  const days = useMemo(() => Array.from({ length: daysInMonth }, (_, index) => index + 1), [daysInMonth]);

  useEffect(() => { if (value) { const next = jalaliFromIso(value); if (next) setView({ year: next.year, month: next.month }); } }, [value]);

  useEffect(() => {
    if (!open) return;
    const closePicker = (event: PointerEvent) => { if (fieldRef.current && !fieldRef.current.contains(event.target as Node)) setOpen(false); };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", closePicker);
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("pointerdown", closePicker); document.removeEventListener("keydown", closeOnEscape); };
  }, [open]);

  function moveMonth(delta: number) {
    const next = view.month + delta;
    setView(next < 1 ? { year: view.year - 1, month: 12 } : next > 12 ? { year: view.year + 1, month: 1 } : { year: view.year, month: next });
  }

  return <div ref={fieldRef} className={`shamsi-field ${className}`}>
    <span>{label}</span>
    <button type="button" className="shamsi-trigger" aria-label={label} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((current) => !current)}>{selected ? formatShamsiDate(value) : "انتخاب تاریخ"}<b>▾</b></button>
    {open && <div className="shamsi-popover" role="dialog" aria-label={`انتخاب ${label}`}>
      <header><button type="button" onClick={() => moveMonth(1)} aria-label="ماه بعد">›</button><strong>{monthNames[view.month - 1]} {faDigits(view.year)}</strong><button type="button" onClick={() => moveMonth(-1)} aria-label="ماه قبل">‹</button></header>
      <div className="shamsi-weekdays">{weekDays.map((day) => <span key={day}>{day}</span>)}</div>
      <div className="shamsi-grid">{Array.from({ length: firstDay }).map((_, index) => <i key={`empty-${index}`} />)}{days.map((day) => { const iso = isoFromJalali(view.year, view.month, day); const disabled = (min !== null && new Date(`${iso}T12:00:00`).getTime() < min) || disabledDates.includes(iso); const active = selected?.year === view.year && selected.month === view.month && selected.day === day; return <button type="button" key={day} disabled={disabled} aria-label={`${day.toLocaleString("fa-IR")} ${monthNames[view.month - 1]} ${faDigits(view.year)}`} aria-pressed={active} className={`${active ? "selected" : ""}${disabledDates.includes(iso) ? " unavailable" : ""}`} onClick={() => { onChange(iso); setOpen(false); }}>{day.toLocaleString("fa-IR")}</button>; })}</div>
    </div>}
  </div>;
}
