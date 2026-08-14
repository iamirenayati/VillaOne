"use client";

import { useState, type FormEvent } from "react";
import { createMarketplaceInquiry, VillaOneApiError } from "../lib/api";

export function InquiryForm({ kind, targetSlug, title }: { kind: "real_estate" | "contractor" | "service"; targetSlug: string; title: string }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "error" | "success">("idle");
  const [statusText, setStatusText] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (name.trim().length < 2 || phone.replace(/\D/g, "").length < 11) {
      setStatus("error");
      setStatusText("نام و شماره موبایل معتبر وارد کنید.");
      return;
    }
    setBusy(true); setStatus("idle"); setStatusText("");
    try {
      await createMarketplaceInquiry({ kind, targetSlug, name: name.trim(), phone, message: message.trim() });
      setStatus("success");
      setStatusText("درخواست شما ثبت شد. تیم ویلاوان برای هماهنگی تماس و معرفی متخصص مناسب با شما تماس می‌گیرد.");
      setMessage("");
    } catch (error) {
      setStatus("error");
      setStatusText(error instanceof VillaOneApiError ? error.message : "ثبت درخواست انجام نشد؛ دوباره تلاش کنید.");
    } finally { setBusy(false); }
  }

  if (status === "success") return <section className="lead-form lead-form-success" role="status" aria-live="polite"><span className="success-check">✓</span><p className="eyebrow dark"><span /> درخواست ثبت شد</p><h2>هماهنگی با کانسیرج</h2><p>{statusText}</p><button type="button" onClick={() => { setStatus("idle"); setStatusText(""); }}>ثبت درخواست دیگر</button></section>;

  return <form className="lead-form" onSubmit={submit} noValidate aria-describedby="lead-form-intro"><p className="eyebrow dark"><span /> پیگیری تلفنی</p><h2>{kind === "real_estate" ? "درخواست مشاوره و بازدید" : kind === "contractor" ? "درخواست برآورد پروژه" : "درخواست هماهنگی خدمت"}</h2><p id="lead-form-intro">درخواست شما درباره «{title}» مستقیم در میز کار تیم ثبت می‌شود.</p><label><span>نام و نام خانوادگی</span><input required minLength={2} value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" aria-invalid={status === "error" ? "true" : undefined} /></label><label><span>شماره موبایل</span><input required dir="ltr" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="0912 123 4567" autoComplete="tel" aria-invalid={status === "error" ? "true" : undefined} /></label><label><span>توضیح کوتاه پروژه</span><textarea rows={4} value={message} onChange={(event) => setMessage(event.target.value)} placeholder={kind === "real_estate" ? "زمان مناسب تماس یا سؤال شما درباره ملک" : kind === "contractor" ? "نوع پروژه، شهر و حدود متراژ" : "تاریخ اقامت و تعداد مهمانان"} /></label><button type="submit" disabled={busy}>{busy ? "در حال ثبت…" : kind === "contractor" ? "درخواست معرفی متخصص" : "ثبت درخواست تماس"}</button><p id="lead-form-status" className={status === "error" ? "lead-status" : "lead-status is-empty"} role={status === "error" ? "alert" : "status"} aria-live="polite">{statusText}</p></form>;
}
