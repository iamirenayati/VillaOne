"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { type BusinessSettings, fetchBusinessSettings } from "../lib/api";
import { BrandLogo } from "./BrandLogo";
import styles from "./PublicFooter.module.css";

// Footer content appears on nearly every public route. Keep one short-lived
// request in flight so client-side navigation does not stampede the settings
// endpoint, while still allowing a later admin edit to surface without a hard
// refresh.
const BUSINESS_CACHE_TTL = 5 * 60 * 1000;
let businessRequest: Promise<BusinessSettings> | null = null;
let businessCache: { value: BusinessSettings; expiresAt: number } | null = null;

function loadBusinessSettings() {
  if (businessCache && businessCache.expiresAt > Date.now()) return Promise.resolve(businessCache.value);
  if (!businessRequest) {
    businessRequest = fetchBusinessSettings()
      .then((settings) => {
        businessCache = { value: settings, expiresAt: Date.now() + BUSINESS_CACHE_TTL };
        return settings;
      })
      .catch((error) => {
        businessRequest = null;
        throw error;
      });
  }
  return businessRequest;
}

export function PublicFooter({ business }: { business?: BusinessSettings | null }) {
  const [loadedBusiness, setLoadedBusiness] = useState<BusinessSettings | null>(business ?? null);
  const [settingsState, setSettingsState] = useState<"loading" | "ready" | "unavailable">(business === undefined ? "loading" : "ready");

  useEffect(() => {
    if (business !== undefined) return;
    let active = true;
    void loadBusinessSettings().then((settings) => {
      if (!active) return;
      setLoadedBusiness(settings);
      setSettingsState("ready");
    }).catch(() => {
      if (active) setSettingsState("unavailable");
    });
    return () => { active = false; };
  }, [business]);

  const details = business ?? loadedBusiness;
  const year = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric" }).format(new Date());
  return (
    <footer className={styles.footer} id="footer">
      <div className={styles.grid}>
        <div className={styles.brand}>
          <Link href="/" aria-label="ویلاوان — صفحه اصلی"><BrandLogo /></Link>
          <p>{details?.footer_description || (settingsState === "loading" ? "در حال دریافت اطلاعات معرفی ویلاوان…" : "اطلاعات معرفی و تماس ویلاوان هنوز ثبت نشده است.")}</p>
        </div>
        <nav aria-label="کشف ویلاوان"><h2>کشف کنید</h2><Link href="/villas">ویلاها</Link><Link href="/map">نقشه</Link><Link href="/services">خدمات سفر</Link><Link href="/journal">مجله</Link></nav>
        <nav aria-label="خدمات بازار"><h2>همراهی ما</h2><Link href="/real-estate">املاک</Link><Link href="/contractors">پیمانکاران</Link><Link href="/support">پشتیبانی</Link><Link href="/account">حساب کاربری</Link></nav>
        <div className={styles.contact}><h2>ارتباط</h2>{details?.support_phone ? <a dir="ltr" href={`tel:${details.support_phone}`}>{details.support_phone}</a> : <span>{settingsState === "loading" ? "در حال دریافت شماره پشتیبانی…" : "شماره پشتیبانی هنوز ثبت نشده است"}</span>}<p>{details?.operating_hours || "ساعات پاسخ‌گویی هنوز ثبت نشده است."}</p></div>
      </div>
      <div className={styles.bottom}><span>© {year} ویلاوان</span><div><Link href="/terms">قوانین</Link><Link href="/privacy">حریم خصوصی</Link><Link href="/cancellation">لغو رزرو</Link></div></div>
    </footer>
  );
}
