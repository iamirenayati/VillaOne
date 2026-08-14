"use client";

import { useEffect, useState } from "react";
import { fetchBusinessSettings } from "../lib/api";
import { InnerHeader } from "./InnerHeader";

type LegalKey = "terms_text" | "privacy_text" | "cancellation_text";

export function LegalPage({ eyebrow, title, intro, legalKey }: { eyebrow: string; title: string; intro: string; legalKey: LegalKey }) {
  const [text, setText] = useState(""); const [updatedAt, setUpdatedAt] = useState(""); const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => { void fetchBusinessSettings().then((settings) => { setText(settings[legalKey] || ""); setUpdatedAt(settings.updated_at); setState("ready"); }).catch(() => setState("error")); }, [legalKey]);
  const sections = text.split(/\n\s*\n/).map((body, index) => ({ title: `بند ${(index + 1).toLocaleString("fa-IR")}`, body })).filter((section) => section.body.trim());
  return <main dir="rtl" className="inner-page legal-page"><InnerHeader /><header className="legal-hero section-shell"><p className="eyebrow dark"><span /> {eyebrow}</p><h1>{title}</h1><p>{intro}</p><small>{updatedAt ? `آخرین به‌روزرسانی: ${new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "long", day: "numeric" }).format(new Date(updatedAt))}` : "در حال دریافت متن رسمی"}</small></header><section className="legal-layout section-shell"><aside><a href="/terms">قوانین رزرو</a><a href="/cancellation">سیاست لغو</a><a href="/privacy">حریم خصوصی</a></aside><article>{state === "loading" && <p>در حال دریافت متن رسمی…</p>}{state === "error" && <p>متن رسمی در دسترس نیست؛ لطفاً بعداً دوباره تلاش کنید.</p>}{state === "ready" && !sections.length && <p>متن رسمی این صفحه هنوز از بخش «تنظیمات کسب‌وکار» منتشر نشده است.</p>}{sections.map((section, index) => <section key={section.title}><span>{(index + 1).toLocaleString("fa-IR", { minimumIntegerDigits: 2 })}</span><div><h2>{section.title}</h2><p>{section.body}</p></div></section>)}</article></section><footer className="mini-footer"><div className="section-shell"><span>ویلاوان</span><div><a href="/support">پشتیبانی</a><a href="/terms">قوانین رزرو</a><a href="/privacy">حریم خصوصی</a></div></div></footer></main>;
}
