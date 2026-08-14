"use client";

import { useEffect, useState } from "react";
import { InnerHeader } from "../components/InnerHeader";
import { createSupportTicket, fetchMyBookings, fetchSupportTickets, hasAuthenticatedSession, type SupportTicket } from "../lib/api";

const statusLabels: Record<SupportTicket["status"], string> = { open: "ثبت‌شده", in_progress: "در حال بررسی", answered: "پاسخ داده شد", closed: "بسته" };

export default function SupportPage() {
  const [ready, setReady] = useState(false);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [bookings, setBookings] = useState<{ code: string; title: string }[]>([]);
  const [form, setForm] = useState({ bookingCode: "", category: "booking" as SupportTicket["category"], subject: "", message: "" });
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!hasAuthenticatedSession()) { window.location.href = "/login?next=/support"; return; }
    void Promise.all([fetchSupportTickets(), fetchMyBookings()]).then(([items, reservations]) => {
      setTickets(items ?? []);
      const options = (reservations ?? []).map((booking) => ({ code: booking.code, title: booking.villa.title }));
      setBookings(options);
      if (options[0]) setForm((current) => ({ ...current, bookingCode: options[0].code }));
    }).finally(() => setReady(true));
  }, []);

  async function submit() {
    if (form.subject.trim().length < 4 || form.message.trim().length < 10) { setNotice("عنوان و توضیحات درخواست را کامل‌تر بنویسید."); return; }
    setSending(true); setNotice("");
    try {
      const created = await createSupportTicket({ ...form, subject: form.subject.trim(), message: form.message.trim() });
      if (!created) throw new Error("برای ثبت درخواست دوباره وارد شوید.");
      setTickets((items) => [created, ...items]);
      setForm((current) => ({ ...current, subject: "", message: "" }));
      setNotice("درخواست شما ثبت شد؛ پاسخ تیم ویلاوان در همین صفحه نمایش داده می‌شود.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "ثبت درخواست انجام نشد."); }
    finally { setSending(false); }
  }

  return <main dir="rtl" className="inner-page support-page"><InnerHeader /><header className="support-hero section-shell"><p className="eyebrow dark"><span /> همراه شما در سفر</p><h1>مرکز پشتیبانی ویلاوان</h1><p>برای رزرو، پرداخت، لغو یا هماهنگی ورود پیام بگذارید. درخواست شما مستقیم به تیم عملیات می‌رسد.</p></header><section className="support-layout section-shell">
    <article className="support-form"><h2>درخواست جدید</h2><div className="support-fields"><label><span>رزرو مرتبط</span><select value={form.bookingCode} onChange={(event) => setForm({ ...form, bookingCode: event.target.value })}><option value="">بدون رزرو مشخص</option>{bookings.map((booking) => <option value={booking.code} key={booking.code}>{booking.title} · {booking.code}</option>)}</select></label><label><span>موضوع درخواست</span><select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as SupportTicket["category"] })}><option value="booking">رزرو</option><option value="payment">پرداخت</option><option value="cancellation">لغو و بازگشت وجه</option><option value="stay">اقامت و ورود</option><option value="other">سایر</option></select></label><label className="wide"><span>عنوان</span><input value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} placeholder="خلاصه درخواست شما" /></label><label className="wide"><span>توضیحات</span><textarea rows={5} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} placeholder="جزئیاتی که به بررسی سریع‌تر کمک می‌کند..." /></label></div><button type="button" disabled={sending} onClick={submit}>{sending ? "در حال ارسال…" : "ثبت درخواست پشتیبانی"}</button>{notice && <p className="support-notice" role="status">{notice}</p>}</article>
    <aside className="support-history"><div><h2>درخواست‌های من</h2><span>{tickets.length.toLocaleString("fa-IR")}</span></div>{!ready ? <p>در حال دریافت درخواست‌ها…</p> : tickets.length ? tickets.map((ticket) => <article key={ticket.id}><header><span className={`ticket-status ${ticket.status}`}>{statusLabels[ticket.status]}</span><small>#{ticket.id.toLocaleString("fa-IR")} {ticket.booking ? `· ${ticket.booking}` : ""}</small></header><h3>{ticket.subject}</h3><p>{ticket.message}</p>{ticket.admin_response && <blockquote><b>پاسخ ویلاوان</b>{ticket.admin_response}</blockquote>}</article>) : <div className="support-empty"><span>؟</span><p>هنوز درخواستی ثبت نکرده‌اید.</p></div>}</aside>
  </section></main>;
}
