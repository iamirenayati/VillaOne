"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { InnerHeader } from "../components/InnerHeader";
import { formatShamsiDate } from "../components/ShamsiDateField";
import {
  type CardTransferInstructions,
  VillaOneApiError,
  fetchCardTransferInstructions,
  hasAuthenticatedSession,
  submitCardTransfer,
} from "../lib/api";
import styles from "./Payment.module.css";

type PaymentState = "loading" | "ready" | "submitted" | "error";

export default function PaymentPage() {
  const code = useSearchParams().get("code") ?? "";
  const [instructions, setInstructions] = useState<CardTransferInstructions | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [referenceId, setReferenceId] = useState("");
  const [state, setState] = useState<PaymentState>("loading");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    if (!code || !hasAuthenticatedSession()) {
      window.location.href = `/login?next=${encodeURIComponent(`/payment?code=${code}`)}`;
      return;
    }
    setState("loading");
    setError("");
    void fetchCardTransferInstructions(code)
      .then((data) => {
        setInstructions(data);
        setState("ready");
      })
      .catch((reason) => {
        setError(reason instanceof Error ? reason.message : "دریافت اطلاعات پرداخت ناموفق بود.");
        setState("error");
      });
  }, [code]);

  useEffect(load, [load]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  async function copyCardNumber() {
    if (!instructions) return;
    try {
      await navigator.clipboard.writeText(instructions.card_number);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  async function submit() {
    if (!file || !code) return;
    setBusy(true);
    setError("");
    try {
      const storageKey = `villaone-transfer-request-${code}`;
      const clientRequestId = window.sessionStorage.getItem(storageKey) || crypto.randomUUID();
      window.sessionStorage.setItem(storageKey, clientRequestId);
      await submitCardTransfer(code, { proofImage: file, referenceId, clientRequestId });
      window.sessionStorage.removeItem(storageKey);
      setState("submitted");
    } catch (reason) {
      setError(reason instanceof VillaOneApiError ? reason.message : "ارسال رسید انجام نشد.");
    } finally {
      setBusy(false);
    }
  }

  const expiry = instructions?.expires_at
    ? `${formatShamsiDate(instructions.expires_at.slice(0, 10))} · ${new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit" }).format(new Date(instructions.expires_at))}`
    : "—";

  return (
    <main dir="rtl" className={`${styles.page} inner-page payment-page`}>
      <InnerHeader />
      <section className="payment-shell section-shell">
        <div className="payment-workspace">
          <article className="payment-card" aria-live="polite">
            <div className="payment-card-head">
              <span className="payment-brand">V1</span>
              <div><small>پرداخت امن رزرو</small><b dir="ltr">{code || "VILLAONE"}</b></div>
              <span className="payment-method-status">کارت‌به‌کارت</span>
            </div>

            {state === "loading" && <div className="payment-state"><span className="payment-loader" /><p className="eyebrow dark"><span /> در حال دریافت اطلاعات</p><h1>در حال آماده‌سازی پرداخت…</h1><p>جزئیات رزرو و مبلغ قابل پرداخت از سرور دریافت می‌شود.</p></div>}

            {state === "error" && <div className="payment-state error"><span className="payment-state-mark">!</span><p className="eyebrow dark"><span /> امکان ادامه وجود ندارد</p><h1>پرداخت در دسترس نیست</h1><p>{error}</p><div className="payment-state-actions"><button className="payment-success-button" type="button" onClick={load}>تلاش دوباره</button><a className="payment-fail-button" href="/account">بازگشت به حساب</a></div></div>}

            {state === "submitted" && <div className="payment-state submitted"><span className="payment-state-mark">✓</span><p className="eyebrow dark"><span /> ارسال موفق رسید</p><h1>رسید شما ثبت شد</h1><p>رسید در صف بررسی تیم مالی است. تا ۲۴ ساعت، زمان اقامت شما نگه داشته می‌شود و نتیجه در حساب و رسید رزرو به‌روز خواهد شد.</p><div className="payment-state-actions"><a className="payment-success-button" href={`/booking-confirmed?code=${encodeURIComponent(code)}`}>مشاهده وضعیت رزرو</a><a className="payment-fail-button" href={`/account/bookings/${encodeURIComponent(code)}`}>مشاهده فاکتور</a></div></div>}

            {state === "ready" && instructions && <>
              <header className="payment-intro">
                <p className="eyebrow dark"><span /> مرحله نهایی نگه‌داری رزرو</p>
                <h1>انتقال وجه و<br />ارسال رسید</h1>
                <p>مبلغ دقیق را به کارت ویلاوان منتقل کنید؛ سپس تصویر رسید را همین‌جا برای بررسی تیم مالی بفرستید.</p>
              </header>

              <div className="payment-amount"><span>مبلغ قابل پرداخت</span><strong>{Number(instructions.amount).toLocaleString("fa-IR")} <small>تومان</small></strong><em>مبلغ را دقیقاً مطابق فاکتور انتقال دهید.</em></div>

              <dl className="payment-transfer-details">
                <div><dt>بانک</dt><dd>{instructions.bank_name}</dd></div>
                <div><dt>دارنده کارت</dt><dd>{instructions.cardholder_name}</dd></div>
                <div className="card-number"><dt>شماره کارت</dt><dd dir="ltr">{instructions.card_number}</dd><button type="button" onClick={() => void copyCardNumber()}>{copied ? "کپی شد ✓" : "کپی شماره"}</button></div>
              </dl>

              <div className="payment-expiry"><span aria-hidden="true">◷</span><p><b>مهلت فعلی رزرو</b><time>{expiry}</time></p></div>

              <div className="payment-proof-form">
                <div className="payment-form-heading"><span>۰۱</span><div><h2>تصویر رسید انتقال</h2><p>فایل خوانا و کامل بارگذاری کنید.</p></div></div>
                <label className={`payment-upload ${previewUrl ? "has-preview" : ""}`}>
                  {previewUrl ? <img src={previewUrl} alt="پیش‌نمایش رسید انتخاب‌شده" /> : <span className="upload-symbol" aria-hidden="true">＋</span>}
                  <span className="upload-copy"><b>{file ? "تغییر تصویر رسید" : "انتخاب تصویر رسید"}</b><small>{file ? `${file.name} · ${(file.size / 1024 / 1024).toLocaleString("fa-IR", { maximumFractionDigits: 1 })} مگابایت` : "JPEG، PNG یا WebP تا ۵ مگابایت"}</small></span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
                </label>

                <div className="payment-form-heading secondary"><span>۰۲</span><div><h2>شماره پیگیری</h2><p>ثبت آن اختیاری است اما بررسی را سریع‌تر می‌کند.</p></div></div>
                <label className="payment-reference"><span>شماره پیگیری بانکی <small>اختیاری</small></span><input dir="ltr" value={referenceId} onChange={(event) => setReferenceId(event.target.value)} maxLength={120} placeholder="مثلاً ۱۲۳۴۵۶۷۸۹" /></label>

                <button className="payment-success-button" type="button" disabled={!file || busy} onClick={() => void submit()}>{busy ? "در حال ارسال امن رسید…" : "ارسال رسید برای بررسی"}</button>
                {error && <p className="checkout-api-error" role="alert">{error}</p>}
              </div>

              <div className="payment-coming-soon-list" aria-label="روش‌های پرداخت آینده"><div className="payment-coming-soon"><span>درگاه زرین‌پال</span><b>به‌زودی</b></div><div className="payment-coming-soon"><span>هماهنگی تلفنی پرداخت</span><b>به‌زودی</b></div></div>
            </>}
          </article>

          <aside className="payment-guide" aria-label="مراحل بررسی پرداخت">
            <p className="eyebrow"><span /> پس از ارسال چه می‌شود؟</p>
            <h2>رزرو شما تا پایان بررسی محفوظ است.</h2>
            <ol><li><span>۱</span><div><b>ارسال رسید</b><p>تصویر به‌صورت محافظت‌شده در حساب شما ثبت می‌شود.</p></div></li><li><span>۲</span><div><b>بررسی تیم مالی</b><p>مبلغ، شماره رزرو و رسید انتقال تطبیق داده می‌شود.</p></div></li><li><span>۳</span><div><b>تأیید اقامت</b><p>پس از تأیید، رزرو قطعی و تاریخ‌ها در تقویم بسته می‌شوند.</p></div></li></ol>
            <a href="/support">نیاز به راهنمایی دارید؟ تماس با پشتیبانی ←</a>
          </aside>
        </div>
      </section>
    </main>
  );
}
