"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { InnerHeader } from "../components/InnerHeader";
import { requestOtp, verifyOtp, VillaOneApiError } from "../lib/api";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const requestedNext = searchParams.get("next") ?? "/account";
  const nextPath = requestedNext.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/account";
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [debugCode, setDebugCode] = useState("");

  async function sendCode() {
    setBusy(true);
    setMessage("");
    try {
      const result = await requestOtp(phone);
      setDebugCode(result.debugCode ?? "");
      setStep("code");
    } catch (error) {
      setMessage(error instanceof VillaOneApiError ? error.message : "ارسال کد انجام نشد؛ دوباره تلاش کنید.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmCode() {
    setBusy(true);
    setMessage("");
    try {
      await verifyOtp(phone, code);
      window.location.href = nextPath;
    } catch (error) {
      setMessage(error instanceof VillaOneApiError ? error.message : "تأیید شماره انجام نشد؛ دوباره تلاش کنید.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main dir="rtl" className="inner-page login-page">
      <InnerHeader />
      <section className="login-shell section-shell">
        <div className="login-art" aria-hidden="true"><span>V1</span><p>ویلاهای خاص<br />سفرهای ماندگار</p></div>
        <div className="login-panel">
          <p className="eyebrow dark"><span /> حساب مهمان</p>
          <h1>{step === "phone" ? "ورود به ویلاوان" : "تأیید شماره موبایل"}</h1>
          <p>{step === "phone" ? "برای مشاهده رزروها و ادامه یک سفر نیمه‌تمام، شماره موبایل خود را وارد کنید." : <>کد شش‌رقمی ارسال‌شده به <b dir="ltr">{phone}</b> را وارد کنید.</>}</p>
          {step === "phone" ? (
            <label className="login-field"><span>شماره موبایل</span><input dir="ltr" inputMode="tel" autoFocus value={phone} onChange={(event) => setPhone(event.target.value.replace(/[^0-9+]/g, ""))} placeholder="0912 123 4567" /></label>
          ) : (
            <label className="login-field"><span>کد تأیید</span><input dir="ltr" inputMode="numeric" autoFocus maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} placeholder="••••••" /></label>
          )}
          {debugCode && step === "code" && <p className="login-debug">کد ورود در محیط محلی: <b dir="ltr">{debugCode}</b></p>}
          {message && <p className="login-error" role="alert">{message}</p>}
          {step === "phone" ? <button className="login-submit" type="button" disabled={busy || phone.length < 11} onClick={sendCode}>{busy ? "در حال ارسال…" : "دریافت کد ورود"}</button> : <button className="login-submit" type="button" disabled={busy || code.length !== 6} onClick={confirmCode}>{busy ? "در حال تأیید…" : "ورود به حساب"}</button>}
          {step === "code" && <button className="login-back" type="button" onClick={() => { setStep("phone"); setCode(""); setMessage(""); }}>ویرایش شماره موبایل</button>}
          <small>با ادامه، قوانین استفاده و حریم خصوصی ویلاوان را می‌پذیرید.</small>
        </div>
      </section>
    </main>
  );
}
