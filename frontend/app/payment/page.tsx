"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { InnerHeader } from "../components/InnerHeader";
import { type CardTransferInstructions, VillaOneApiError, fetchCardTransferInstructions, hasAuthenticatedSession, submitCardTransfer } from "../lib/api";
import { formatShamsiDate } from "../components/ShamsiDateField";

export default function PaymentPage() {
  const code = useSearchParams().get("code") ?? "";
  const [instructions, setInstructions] = useState<CardTransferInstructions | null>(null);
  const [file, setFile] = useState<File | null>(null); const [referenceId, setReferenceId] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "submitted" | "error">("loading"); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const load = () => {
    if (!code || !hasAuthenticatedSession()) { window.location.href = `/login?next=${encodeURIComponent(`/payment?code=${code}`)}`; return; }
    setState("loading"); setError("");
    void fetchCardTransferInstructions(code).then((data) => { setInstructions(data); setState("ready"); }).catch((reason) => { setError(reason instanceof Error ? reason.message : "دریافت اطلاعات پرداخت ناموفق بود."); setState("error"); });
  };
  useEffect(load, [code]);
  async function submit() {
    if (!file || !code) return; setBusy(true); setError("");
    try {
      const storageKey = `villaone-transfer-request-${code}`;
      const clientRequestId = window.sessionStorage.getItem(storageKey) || crypto.randomUUID();
      window.sessionStorage.setItem(storageKey, clientRequestId);
      await submitCardTransfer(code, { proofImage: file, referenceId, clientRequestId });
      window.sessionStorage.removeItem(storageKey);
      setState("submitted");
    }
    catch (reason) { setError(reason instanceof VillaOneApiError ? reason.message : "ارسال رسید انجام نشد."); }
    finally { setBusy(false); }
  }
  const expiry = instructions?.expires_at ? `${formatShamsiDate(instructions.expires_at.slice(0, 10))} · ${new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit" }).format(new Date(instructions.expires_at))}` : "—";
  return <main dir="rtl" className="inner-page payment-page"><InnerHeader /><section className="payment-shell section-shell"><div className="payment-card">
    <p className="eyebrow dark"><span /> پرداخت رزرو</p>
    {state === "loading" && <><h1>در حال آماده‌سازی پرداخت…</h1><p>اطلاعات رزرو شما در حال دریافت است.</p></>}
    {state === "error" && <><h1>پرداخت در دسترس نیست</h1><p>{error}</p><button className="payment-success-button" type="button" onClick={load}>تلاش دوباره</button><a className="payment-fail-button" href="/account">حساب کاربری</a></>}
    {state === "submitted" && <><h1>رسید شما ثبت شد</h1><p>رسید در صف بررسی تیم مالی است. تا ۲۴ ساعت، زمان اقامت شما نگه داشته می‌شود. نتیجه از داخل رسید رزرو قابل مشاهده است.</p><a className="payment-success-button" href={`/booking-confirmed?code=${encodeURIComponent(code)}`}>مشاهده وضعیت رزرو</a><a className="payment-fail-button" href={`/account/bookings/${encodeURIComponent(code)}`}>مشاهده فاکتور</a></>}
    {state === "ready" && instructions && <><h1>کارت به کارت</h1><p>مبلغ زیر را به کارت ویلاوان منتقل کنید و تصویر رسید را بارگذاری کنید. تأیید پرداخت توسط تیم مالی انجام می‌شود.</p><div className="payment-transfer-details"><div><span>مبلغ قابل پرداخت</span><strong>{Number(instructions.amount).toLocaleString("fa-IR")} تومان</strong></div><div><span>بانک</span><b>{instructions.bank_name}</b></div><div><span>به نام</span><b>{instructions.cardholder_name}</b></div><div><span>شماره کارت</span><b dir="ltr">{instructions.card_number}</b><button type="button" onClick={() => navigator.clipboard?.writeText(instructions.card_number)}>کپی</button></div></div><p className="payment-expiry">مهلت فعلی رزرو: {expiry}</p><label className="payment-upload"><span>تصویر رسید انتقال</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><small>{file ? file.name : "JPEG، PNG یا WebP تا ۵ مگابایت"}</small></label><label className="payment-upload"><span>شماره پیگیری <small>اختیاری</small></span><input dir="ltr" value={referenceId} onChange={(event) => setReferenceId(event.target.value)} maxLength={120} placeholder="شماره پیگیری بانکی" /></label><button className="payment-success-button" type="button" disabled={!file || busy} onClick={submit}>{busy ? "در حال ارسال رسید…" : "ارسال رسید برای بررسی"}</button>{error && <p className="checkout-api-error" role="alert">{error}</p>}<div className="payment-coming-soon"><span>زرین‌پال</span><b>به‌زودی</b></div><div className="payment-coming-soon"><span>هماهنگی تلفنی پرداخت</span><b>به‌زودی</b></div></>}
  </div></section></main>;
}
