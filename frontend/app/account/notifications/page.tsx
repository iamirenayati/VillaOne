"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { InnerHeader } from "../../components/InnerHeader";
import { formatPersianDate, type ApiUser, type CustomerNotification, fetchCurrentUser, fetchCustomerNotifications, hasAuthenticatedSession, markCustomerNotificationRead, updateCurrentUser } from "../../lib/api";
import styles from "./Notifications.module.css";

export default function NotificationCenterPage() {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [items, setItems] = useState<CustomerNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    if (!hasAuthenticatedSession()) { window.location.href = "/login?next=/account/notifications"; return; }
    setLoading(true); setError("");
    Promise.all([fetchCurrentUser(), fetchCustomerNotifications()])
      .then(([currentUser, notifications]) => { setUser(currentUser); setItems(notifications ?? []); })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "دریافت اعلان‌ها انجام نشد."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  async function read(item: CustomerNotification) {
    if (item.read_at) return;
    try { const updated = await markCustomerNotificationRead(item.id); setItems((rows) => rows.map((row) => row.id === item.id ? updated : row)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "ثبت مشاهده اعلان انجام نشد."); }
  }

  async function save() {
    if (!user) return;
    setSaving(true); setMessage("");
    try { const updated = await updateCurrentUser(user); if (updated) setUser(updated); setMessage("تنظیمات اعلان ذخیره شد."); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : "ذخیره تنظیمات انجام نشد."); }
    finally { setSaving(false); }
  }

  return <main dir="rtl" className={`${styles.page} inner-page notification-page`}><InnerHeader /><section className="notification-shell section-shell">
    <Link href="/account">← بازگشت به حساب</Link><p className="eyebrow dark"><span /> مرکز فعالیت</p><h1>اعلان‌ها و پیگیری‌ها</h1><p>تغییرات رزرو، رسید پرداخت، لغو و پاسخ پشتیبانی در این بخش ثبت می‌شود.</p>
    {error && <div className="notification-error" role="alert"><p>{error}</p><button type="button" onClick={load}>تلاش دوباره</button></div>}
    {loading ? <div className="notification-loading">در حال دریافت اعلان‌ها…</div> : <section className="notification-inbox" aria-label="اعلان‌های حساب"><header><h2>فعالیت‌های اخیر</h2><span>{items.filter((item) => !item.read_at).length.toLocaleString("fa-IR")} خوانده‌نشده</span></header>{items.length ? items.map((item) => <button type="button" key={item.id} className={item.read_at ? "read" : "unread"} onClick={() => void read(item)}><span><b>{item.title}</b><small>{item.message}</small></span><time>{formatPersianDate(item.created_at)}</time>{item.booking_code && <em dir="ltr">{item.booking_code}</em>}</button>) : <p className="notification-empty">هنوز فعالیتی برای نمایش وجود ندارد.</p>}</section>}
    {user && <section className="notification-options"><h2>تنظیمات ارتباطی آینده</h2><p>پیامک هنوز فعال نیست؛ این انتخاب‌ها برای اتصال سرویس پیامک در آینده نگهداری می‌شوند.</p><label><span><b>پیامک وضعیت رزرو</b><small>تأیید، تغییر و لغو رزرو</small></span><input type="checkbox" checked={user.booking_sms_enabled} onChange={(event) => setUser({ ...user, booking_sms_enabled: event.target.checked })} /></label><label><span><b>پیشنهادهای ویژه پیامکی</b><small>ارسال فقط پس از فعال‌شدن سرویس پیامک</small></span><input type="checkbox" checked={user.marketing_sms_enabled} onChange={(event) => setUser({ ...user, marketing_sms_enabled: event.target.checked })} /></label><label><span><b>اعلان‌های ایمیلی</b><small>رسیدها و به‌روزرسانی‌های سفر</small></span><input type="checkbox" checked={user.email_notifications_enabled} onChange={(event) => setUser({ ...user, email_notifications_enabled: event.target.checked })} /></label><button type="button" disabled={saving} onClick={save}>{saving ? "در حال ذخیره…" : "ذخیره تنظیمات"}</button></section>}
    {message && <p className="notification-message" role="status">{message}</p>}
  </section></main>;
}
