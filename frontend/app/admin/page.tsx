"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { formatShamsiDate, ShamsiDateField } from "../components/ShamsiDateField";
import {
  actOnAdminCancellation,
  bulkUpdateVillaAvailability,
  decideAdminBooking,
  djangoAdminUrl,
  fetchAdminAuditLogs,
  fetchAdminBookings,
  fetchAdminCancellations,
  fetchAdminContractors,
  fetchAdminInquiries,
  fetchAdminOperationsOverview,
  fetchAdminSystemStatus,
  fetchAdminSupportTickets,
  fetchAdminServices,
  fetchAdminBookingServices,
  fetchAdminServiceAvailability,
  fetchAdminVillas,
  fetchCurrentUser,
  fetchVillaAvailability,
  fetchVillas,
  hasAuthenticatedSession,
  reviewAdminCardTransferPayment,
  fetchAdminCardTransferPayments,
  fetchAdminCardTransferProof,
  updateAdminContractor,
  updateAdminInquiry,
  updateAdminSupportTicket,
  updateAdminService,
  updateAdminBookingService,
  updateAdminServiceAvailability,
  updateVillaAdmin,
  updateVillaAvailability,
  updateVillaPriceOverride,
  type AdminAuditLog,
  type AdminCardTransferPayment,
  type AdminCancellation,
  type AdminContractor,
  type AdminInquiry,
  type AdminOperationsOverview,
  type AdminSystemStatus,
  type AdminSupportTicket,
  type AdminServiceOffer,
  type AdminBookingService,
  type ServiceAvailabilityDay,
  type AdminVilla,
  type ApiAvailabilityDay,
  type ApiBooking,
  type ApiUser,
} from "../lib/api";
import type { VillaListing } from "../types/villa";

type AdminView = "overview" | "bookings" | "calendar" | "villas" | "services" | "contractors" | "leads" | "support" | "cancellations" | "finance" | "audit";
const adminViews: AdminView[] = ["overview", "bookings", "calendar", "villas", "services", "contractors", "leads", "support", "cancellations", "finance", "audit"];

function requestedAdminView() {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("view");
  return adminViews.includes(value as AdminView) ? value as AdminView : null;
}

function roleCanOpenView(role: ApiUser["role"], view: AdminView) {
  if (role === "super_admin") return true;
  if (["overview", "bookings", "audit"].includes(view)) return role === "content_admin" || role === "finance_admin";
  if (["calendar", "villas", "services", "contractors", "leads", "support"].includes(view)) return role === "content_admin";
  return role === "finance_admin";
}

const bookingLabels: Record<ApiBooking["status"], string> = { pending_owner: "در انتظار تأیید", confirmed: "تأییدشده", cancelled: "لغوشده", completed: "تکمیل‌شده", expired: "منقضی‌شده" };
const inquiryLabels: Record<AdminInquiry["status"], string> = { new: "جدید", contacted: "تماس گرفته شد", introduced: "معرفی شد", closed: "بسته" };
const supportLabels: Record<AdminSupportTicket["status"], string> = { open: "باز", in_progress: "در حال بررسی", answered: "پاسخ داده شد", closed: "بسته" };
const cancellationLabels: Record<AdminCancellation["status"], string> = { requested: "در انتظار بررسی", approved: "تأییدشده", rejected: "ردشده", refunded: "وجه بازگردانده شد" };
const auditLabels: Record<string, string> = {
  "booking.confirmed": "تأیید رزرو", "booking.rejected": "رد رزرو", "booking.completed": "تکمیل اقامت",
  "payment.manually_reconciled": "وصول پرداخت دستی", "cancellation.approved": "تأیید لغو", "cancellation.rejected": "رد لغو",
  "cancellation.refunded": "ثبت بازگشت وجه", "support.updated": "به‌روزرسانی پشتیبانی", "villa.updated": "ویرایش ویلا",
  "availability.updated": "ویرایش یک روز تقویم", "availability.bulk_updated": "ویرایش گروهی تقویم", "price_override.updated": "ویرایش قیمت روز",
  "contractor.updated": "ویرایش پیمانکار", "inquiry.updated": "به‌روزرسانی پیگیری", "business_settings.updated": "ویرایش تنظیمات کسب‌وکار",
};

function isoToday() { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function addIsoDays(iso: string, amount: number) { const date = new Date(`${iso}T12:00:00`); date.setDate(date.getDate() + amount); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function money(value: string | number) { return Number(value).toLocaleString("fa-IR"); }
function shamsiDateTime(value: string) { return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
function errorText(error: unknown, fallback: string) { return error instanceof Error ? error.message : fallback; }

function trapDialogFocus(event: KeyboardEvent, panel: HTMLElement | null) {
  if (event.key !== "Tab" || !panel) return;
  const focusable = Array.from(panel.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter((element) => !element.hasAttribute("disabled"));
  if (!focusable.length) return;
  const first = focusable[0]; const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}

type AdminConfirmation = {
  title: string;
  message: string;
  confirmLabel?: string;
  tone?: "default" | "danger";
};

type PendingConfirmation = AdminConfirmation & { resolve: (confirmed: boolean) => void };
const AdminConfirmationContext = createContext<((options: AdminConfirmation) => Promise<boolean>) | null>(null);

function useAdminConfirm() {
  const confirm = useContext(AdminConfirmationContext);
  if (!confirm) throw new Error("useAdminConfirm must be used inside AdminConfirmationProvider");
  return confirm;
}

function AdminConfirmationProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirmation | null>(null);
  const confirm = useCallback((options: AdminConfirmation) => new Promise<boolean>((resolve) => {
    setPending({ ...options, resolve });
  }), []);
  const finish = useCallback((confirmed: boolean) => {
    setPending((current) => {
      current?.resolve(confirmed);
      return null;
    });
  }, []);

  return <AdminConfirmationContext.Provider value={confirm}>
    {children}
    {pending && <AdminConfirmDialog options={pending} onFinish={finish} />}
  </AdminConfirmationContext.Provider>;
}

function AdminConfirmDialog({ options, onFinish }: { options: AdminConfirmation; onFinish: (confirmed: boolean) => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    confirmRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); onFinish(false); return; }
      trapDialogFocus(event, panelRef.current);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => { window.removeEventListener("keydown", onKeyDown, true); document.body.style.overflow = previousOverflow; previous?.focus(); };
  }, [onFinish]);

  return <div className="admin-modal-backdrop admin-confirm-backdrop" onMouseDown={() => onFinish(false)}>
    <div ref={panelRef} className="admin-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="admin-confirm-title" aria-describedby="admin-confirm-message" onMouseDown={(event) => event.stopPropagation()}>
      <span className={options.tone === "danger" ? "admin-confirm-icon is-danger" : "admin-confirm-icon"} aria-hidden="true">!</span>
      <h2 id="admin-confirm-title">{options.title}</h2>
      <p id="admin-confirm-message">{options.message}</p>
      <div className="admin-confirm-actions">
        <button type="button" onClick={() => onFinish(false)}>انصراف</button>
        <button ref={confirmRef} className={options.tone === "danger" ? "is-danger" : "is-primary"} type="button" onClick={() => onFinish(true)}>{options.confirmLabel ?? "تأیید"}</button>
      </div>
    </div>
  </div>;
}

export default function AdminPage() {
  const [access, setAccess] = useState<"checking" | "allowed" | "denied">("checking");
  const [user, setUser] = useState<ApiUser | null>(null);
  const [view, setView] = useState<AdminView>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const openView = useCallback((next: AdminView) => {
    setView(next);
    const url = new URL(window.location.href);
    if (next === "overview") url.searchParams.delete("view"); else url.searchParams.set("view", next);
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);
  const calendarStart = useMemo(isoToday, []);
  const calendarDates = useMemo(() => Array.from({ length: 30 }, (_, index) => addIsoDays(calendarStart, index)), [calendarStart]);

  useEffect(() => {
    if (!hasAuthenticatedSession()) { window.location.replace("/login?next=%2Fadmin"); return; }
    fetchCurrentUser().then((value) => {
      if (value && ["content_admin", "finance_admin", "super_admin"].includes(value.role)) { const requested = requestedAdminView(); setUser(value); setView(requested && roleCanOpenView(value.role, requested) ? requested : "overview"); setAccess("allowed"); }
      else setAccess("denied");
    }).catch(() => setAccess("denied"));
    fetchAdminOperationsOverview().then((value) => setPendingCount(value?.pending_bookings ?? 0)).catch(() => undefined);
  }, []);

  useEffect(() => {
    const redirectToLogin = () => window.location.replace("/login?next=%2Fadmin");
    window.addEventListener("villaone-session-expired", redirectToLogin);
    return () => window.removeEventListener("villaone-session-expired", redirectToLogin);
  }, []);

  useEffect(() => {
    if (!sidebarOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setSidebarOpen(false); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", closeOnEscape); };
  }, [sidebarOpen]);

  if (access === "checking") return <main dir="rtl" className="admin-access-state"><span className="status-pulse" /><h1>در حال بررسی دسترسی مدیر…</h1></main>;
  if (access === "denied" || !user) return <main dir="rtl" className="admin-access-state"><span className="brand-mark"><i>V</i><b>1</b></span><h1>دسترسی مدیر لازم است</h1><p>برای ورود به مرکز عملیات، با حساب مدیر وارد شوید.</p><a href="/login?next=/admin">ورود به حساب مدیر</a></main>;

  const isContent = user.role === "content_admin" || user.role === "super_admin";
  const isFinance = user.role === "finance_admin" || user.role === "super_admin";
  const roleLabel = { super_admin: "مدیر ارشد", content_admin: "مدیر محتوا و عملیات", finance_admin: "مدیر مالی" }[user.role] ?? user.role;
  const displayName = `${user.first_name} ${user.last_name}`.trim() || user.phone;
  const titles: Record<AdminView, string> = { overview: "نمای کلی", bookings: "مدیریت رزروها", calendar: "تقویم و ظرفیت", villas: "ویلاها", services: "خدمات اقامت", contractors: "پیمانکاران", leads: "پیگیری درخواست‌ها", support: "پشتیبانی مشتریان", cancellations: "درخواست‌های لغو", finance: "مالی و تسویه", audit: "گزارش فعالیت‌ها" };
  const nav: { key: AdminView; label: string; icon: string; visible: boolean; count?: number }[] = [
    { key: "overview", label: "نمای کلی", icon: "⌂", visible: true }, { key: "bookings", label: "رزروها", icon: "▣", visible: true, count: pendingCount },
    { key: "calendar", label: "تقویم و ظرفیت", icon: "□", visible: isContent }, { key: "villas", label: "ویلاها", icon: "◇", visible: isContent },
    { key: "services", label: "خدمات اقامت", icon: "✦", visible: isContent },
    { key: "contractors", label: "پیمانکاران", icon: "♧", visible: isContent }, { key: "leads", label: "درخواست‌های بازار", icon: "◎", visible: isContent },
    { key: "support", label: "پشتیبانی", icon: "?", visible: isContent }, { key: "finance", label: "مالی و تسویه", icon: "◉", visible: isFinance },
    { key: "cancellations", label: "لغو و بازگشت وجه", icon: "×", visible: isFinance }, { key: "audit", label: "گزارش فعالیت‌ها", icon: "≡", visible: true },
  ];

  return <AdminConfirmationProvider><main dir="rtl" className="admin-page">
    {sidebarOpen && <button type="button" className="admin-sidebar-scrim" aria-label="بستن منوی مدیریت" onClick={() => setSidebarOpen(false)} />}
    <aside id="admin-sidebar" className={sidebarOpen ? "admin-sidebar is-open" : "admin-sidebar"} aria-label="ناوبری مرکز عملیات">
      <div className="admin-brand"><a href="/"><span>V1</span><div><strong>VILLAONE</strong><small>مرکز عملیات</small></div></a><button type="button" onClick={() => setSidebarOpen(false)}>×</button></div>
      <nav className="admin-nav" aria-label="پنل مدیریت">{nav.filter((item) => item.visible).map((item) => <button key={item.key} className={view === item.key ? "active" : ""} type="button" aria-current={view === item.key ? "page" : undefined} onClick={() => { openView(item.key); setSidebarOpen(false); }}><i aria-hidden="true">{item.icon}</i><span>{item.label}</span>{Boolean(item.count) && <b>{item.count?.toLocaleString("fa-IR")}</b>}</button>)}</nav>
      <div className="admin-sidebar-foot"><a href="/" target="_blank">↗ مشاهده وب‌سایت</a><div><span>{displayName[0]}</span><p><strong>{displayName}</strong><small>{roleLabel}</small></p></div></div>
    </aside>
    <section className="admin-workspace">
      <header className="admin-header"><div><button className="admin-mobile-menu" type="button" aria-label="باز کردن منوی مدیریت" aria-controls="admin-sidebar" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(true)}>☰</button><span>امروز، {new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date())}</span></div><div className="admin-header-actions"><a href="/villas" target="_blank">مشاهده وب‌سایت</a></div></header>
      <div className="admin-content"><div className="admin-page-heading"><div><p>مرکز عملیات ویلاوان</p><h1>{titles[view]}</h1></div>{isContent && djangoAdminUrl() && <div className="admin-heading-actions"><a href={djangoAdminUrl() ?? "#"} target="_blank">مدیریت محتوای سایت</a></div>}</div>
        {view === "overview" && <OperationsOverview onNavigate={openView} />}
        {view === "bookings" && <BookingOperations canDecide={isContent} />}
        {view === "calendar" && <><BulkAvailabilityPanel /><CalendarView calendarDates={calendarDates} /></>}
        {view === "villas" && <VillaOperations onOpenCalendar={() => openView("calendar")} />}
        {view === "services" && <ServiceOperations />}
        {view === "contractors" && <ContractorOperations />}
        {view === "leads" && <LeadOperations />}
        {view === "support" && <SupportOperations />}
        {view === "finance" && <FinanceOperations />}
        {view === "cancellations" && <CancellationOperations />}
        {view === "audit" && <AuditOperations />}
      </div>
    </section>
  </main></AdminConfirmationProvider>;
}

function OperationsOverview({ onNavigate }: { onNavigate: (view: AdminView) => void }) {
  const [data, setData] = useState<AdminOperationsOverview | null>(null); const [system, setSystem] = useState<AdminSystemStatus | null>(null); const [error, setError] = useState("");
  const load = () => { setError(""); Promise.all([fetchAdminOperationsOverview(), fetchAdminSystemStatus()]).then(([overview, status]) => { setData(overview); setSystem(status); }).catch((reason) => setError(errorText(reason, "دریافت وضعیت عملیات ناموفق بود."))); };
  useEffect(load, []);
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <LoadingState message="در حال دریافت وضعیت زنده…" />;
  const metrics: [string, number, AdminView][] = [["رزرو در انتظار", data.pending_bookings, "bookings"], ["نگه‌داری رو به پایان", data.expiring_holds, "bookings"], ["خدمت در انتظار اجرا", data.pending_services, "services"], ["رسید در انتظار", data.pending_transfer_receipts, "finance"], ["رسید رو به پایان", data.expiring_transfer_reviews, "finance"], ["رزرو بدون پرداخت", data.unpaid_bookings, "finance"], ["تیکت باز", data.open_support_tickets, "support"], ["درخواست لغو", data.open_cancellations, "cancellations"], ["پیگیری عقب‌افتاده", data.overdue_follow_ups, "leads"], ["لید بدون معرفی", data.unassigned_leads, "leads"], ["روز مسدود", data.blocked_days, "calendar"]];
  return <>{system && <section className={`admin-panel system-health-panel ${system.status}`}><div><span className="system-health-dot"/><p><b>{system.status === "ok" ? "عملیات پس‌زمینه سالم است" : "عملیات پس‌زمینه نیاز به بررسی دارد"}</b><small>{system.scheduler_stale ? "اجرای زمان‌بندی‌شده بیش از دو دقیقه به‌روز نشده است." : "خانه‌داری رزرو و بررسی یکپارچگی ثبت و قابل پیگیری است."}</small></p></div><ul>{Object.entries(system.tasks).map(([name, task]) => <li key={name}><span>{name === "process_operational_tasks" ? "آزادسازی رزروهای منقضی" : "بررسی یکپارچگی"}</span><b>{task.status === "succeeded" ? "موفق" : task.status === "failed" ? "ناموفق" : "در حال اجرا"}</b>{task.error_summary && <small>{task.error_summary}</small>}</li>)}</ul></section>}<section className="admin-panel contractor-ops-summary">{metrics.map(([label, value, target]) => <button type="button" key={label} onClick={() => onNavigate(target)}><span>{label}</span><strong>{value.toLocaleString("fa-IR")}</strong></button>)}</section><section className="admin-panel requests-panel"><div className="panel-head"><div><h2>آخرین رزروها</h2><p>فقط داده‌های ثبت‌شده در سامانه</p></div><button type="button" onClick={() => onNavigate("bookings")}>مدیریت رزروها ←</button></div>{data.recent_bookings.length ? <BookingTable bookings={data.recent_bookings} /> : <EmptyState message="هنوز رزروی ثبت نشده است." />}</section></>;
}

function BookingOperations({ canDecide }: { canDecide: boolean }) {
  const confirmAdmin = useAdminConfirm();
  const [items, setItems] = useState<ApiBooking[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [query, setQuery] = useState(""); const [status, setStatus] = useState("all"); const [selected, setSelected] = useState<ApiBooking | null>(null);
  const load = () => { setLoading(true); setError(""); fetchAdminBookings(status === "all" ? undefined : status).then((value) => setItems(value ?? [])).catch((reason) => setError(errorText(reason, "دریافت رزروها ناموفق بود."))).finally(() => setLoading(false)); };
  useEffect(load, [status]);
  async function decide(code: string, action: "approve" | "reject") { if (!(await confirmAdmin({ title: action === "approve" ? "تأیید رزرو" : "رد رزرو", message: action === "approve" ? "رزرو تأیید و تاریخ‌ها قفل شوند؟" : "این درخواست رزرو رد شود؟", confirmLabel: action === "approve" ? "تأیید رزرو" : "رد رزرو", tone: action === "reject" ? "danger" : "default" }))) return; try { await decideAdminBooking(code, action); setMessage(action === "approve" ? "رزرو تأیید شد." : "رزرو رد شد."); load(); } catch (reason) { setMessage(errorText(reason, "تغییر وضعیت انجام نشد.")); } }
  const visible = items.filter((item) => !query.trim() || `${item.code} ${item.villa.title} ${item.villa.city.name}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <section className="admin-panel"><div className="panel-head"><div><h2>صف رزروهای سامانه</h2><p>{loading ? "در حال دریافت…" : `${visible.length.toLocaleString("fa-IR")} رزرو`}</p></div><div className="admin-filters"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جست‌وجوی کد، ویلا یا شهر…" /><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">همه وضعیت‌ها</option>{Object.entries(bookingLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div></div>{message && <p className="admin-inline-message" role="status">{message}</p>}{error ? <ErrorState message={error} onRetry={load} /> : loading ? <LoadingState message="در حال دریافت رزروها…" /> : visible.length ? <div className="booking-table-wrap"><table className="admin-table"><thead><tr><th>کد</th><th>اقامتگاه</th><th>تاریخ</th><th>مبلغ</th><th>وضعیت</th><th>پرداخت</th><th /></tr></thead><tbody>{visible.map((item) => { const pendingReceipt = item.payments.find((payment) => payment.gateway === "card_to_card" && payment.status === "pending"); return <tr key={item.code}><td dir="ltr"><b>{item.code}</b></td><td>{item.villa.title}<small>{item.villa.city.name}</small></td><td>{formatShamsiDate(item.checkin)} تا {formatShamsiDate(item.checkout)}</td><td>{money(item.total_price)} تومان</td><td><Status value={bookingLabels[item.status]} state={item.status} /></td><td>{pendingReceipt ? <span className="admin-status pending"><i />رسید در انتظار بررسی</span> : item.payments.some((payment) => payment.gateway === "card_to_card" && payment.status === "paid") ? <span className="admin-status confirmed"><i />پرداخت تأییدشده</span> : "—"}</td><td><button type="button" onClick={() => setSelected(item)}>جزئیات</button>{canDecide && item.status === "pending_owner" && !pendingReceipt && <span className="live-booking-actions"><button type="button" onClick={() => decide(item.code, "reject")}>رد</button><button type="button" onClick={() => decide(item.code, "approve")}>تأیید</button></span>}</td></tr>; })}</tbody></table></div> : <EmptyState message="رزروی با این شرایط وجود ندارد." />}{selected && <BookingDetail booking={selected} onClose={() => setSelected(null)} />}</section>;
}

function BookingTable({ bookings }: { bookings: ApiBooking[] }) { return <div className="booking-table-wrap"><table className="admin-table"><thead><tr><th>کد</th><th>ویلا</th><th>تاریخ</th><th>مبلغ</th><th>وضعیت</th></tr></thead><tbody>{bookings.map((item) => <tr key={item.code}><td dir="ltr">{item.code}</td><td>{item.villa.title}</td><td>{formatShamsiDate(item.checkin)} تا {formatShamsiDate(item.checkout)}</td><td>{money(item.total_price)} تومان</td><td>{bookingLabels[item.status]}</td></tr>)}</tbody></table></div>; }

function BookingDetail({ booking, onClose }: { booking: ApiBooking; onClose: () => void }) { return <Modal title={`رزرو ${booking.code}`} onClose={onClose}><dl><div><dt>اقامتگاه</dt><dd>{booking.villa.title}</dd></div><div><dt>اقامت</dt><dd>{formatShamsiDate(booking.checkin)} تا {formatShamsiDate(booking.checkout)}</dd></div><div><dt>مهمانان</dt><dd>{booking.guests_count.toLocaleString("fa-IR")} نفر</dd></div><div><dt>وضعیت</dt><dd>{bookingLabels[booking.status]}</dd></div><div><dt>هزینه اقامت</dt><dd>{money(booking.stay_total)} تومان</dd></div><div><dt>خدمات</dt><dd>{money(booking.services_total)} تومان</dd></div><div><dt>مبلغ کل</dt><dd>{money(booking.total_price)} تومان</dd></div><div><dt>پرداخت‌شده</dt><dd>{money(booking.deposit_paid_online)} تومان</dd></div></dl><h3>خدمات انتخابی</h3>{booking.service_items.length ? <ul>{booking.service_items.map((item) => <li key={item.slug}>{item.title} · {item.quantity.toLocaleString("fa-IR")} عدد · {money(item.total_price)} تومان</li>)}</ul> : <p>خدمت تکمیلی انتخاب نشده است.</p>}<h3>یادداشت مهمان</h3><p>{booking.guest_note || "یادداشتی ثبت نشده است."}</p></Modal>; }

function FinanceOperations() {
  const [data, setData] = useState<{ count: number; results: AdminCardTransferPayment[]; next: string | null; previous: string | null } | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [query, setQuery] = useState(""); const [appliedQuery, setAppliedQuery] = useState(""); const [status, setStatus] = useState<"pending" | "paid" | "failed" | "all">("pending"); const [page, setPage] = useState(1); const [selected, setSelected] = useState<AdminCardTransferPayment | null>(null);
  const load = () => { setLoading(true); setError(""); fetchAdminCardTransferPayments({ status, q: appliedQuery, page }).then((value) => setData(value)).catch((reason) => setError(errorText(reason, "دریافت صف بررسی رسید ناموفق بود."))).finally(() => setLoading(false)); };
  useEffect(load, [status, appliedQuery, page]);
  function applySearch(event: React.FormEvent) { event.preventDefault(); setPage(1); setAppliedQuery(query); }
  return <><section className="admin-panel finance-queue"><div className="panel-head"><div><h2>صف بررسی رسید کارت‌به‌کارت</h2><p>{data ? `${data.count.toLocaleString("fa-IR")} رسید` : "دریافت صف…"}</p></div><form className="admin-filters" onSubmit={applySearch}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="کد، ویلا، مشتری، موبایل یا مرجع…" /><select value={status} onChange={(event) => { setStatus(event.target.value as typeof status); setPage(1); }}><option value="pending">در انتظار بررسی</option><option value="paid">تأییدشده</option><option value="failed">ردشده</option><option value="all">همه رسیدها</option></select><button type="submit">جست‌وجو</button></form></div>{error ? <ErrorState message={error} onRetry={load} /> : loading && !data ? <LoadingState message="در حال دریافت صف مالی…" /> : data?.results.length ? <div className="booking-table-wrap"><table className="admin-table finance-review-table"><thead><tr><th>رزرو</th><th>مشتری</th><th>اقامتگاه</th><th>مبلغ</th><th>مهلت/بررسی</th><th>وضعیت</th><th /></tr></thead><tbody>{data.results.map((payment) => <tr key={payment.id}><td dir="ltr"><b>{payment.booking_code}</b><small>{formatShamsiDate(payment.stay.checkin)} تا {formatShamsiDate(payment.stay.checkout)}</small></td><td>{payment.customer.name}<small dir="ltr">{payment.customer.phone}</small></td><td>{payment.villa.title}<small>{payment.villa.city}</small></td><td>{money(payment.amount)} تومان<small>{payment.financials.payment_plan === "full" ? "تسویه کامل" : "بیعانه"}</small></td><td>{payment.status === "pending" ? payment.hold_expires_at ? shamsiDateTime(payment.hold_expires_at) : "—" : payment.reviewed_at ? shamsiDateTime(payment.reviewed_at) : "—"}</td><td><Status value={payment.status === "paid" ? "تأییدشده" : payment.status === "failed" ? "ردشده" : "در انتظار بررسی"} state={payment.status} /></td><td><button type="button" onClick={() => setSelected(payment)}>بررسی رسید</button></td></tr>)}</tbody></table></div> : <EmptyState message="رسیدی با این شرایط وجود ندارد." />}{data && <div className="admin-pagination"><button type="button" disabled={!data.previous || loading} onClick={() => setPage((current) => Math.max(1, current - 1))}>صفحه قبل</button><span>صفحه {page.toLocaleString("fa-IR")}</span><button type="button" disabled={!data.next || loading} onClick={() => setPage((current) => current + 1)}>صفحه بعد</button></div>}</section>{selected && <PaymentReviewDrawer payment={selected} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); load(); }} />}</>;
}

function PaymentReviewDrawer({ payment, onClose, onSaved }: { payment: AdminCardTransferPayment; onClose: () => void; onSaved: () => void }) {
  const [imageUrl, setImageUrl] = useState(""); const [imageError, setImageError] = useState(""); const [imageLoading, setImageLoading] = useState(payment.proof_available); const [proofReload, setProofReload] = useState(0); const [zoom, setZoom] = useState(1); const [decision, setDecision] = useState<"approve" | "reject" | null>(null); const [note, setNote] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const loadProof = () => setProofReload((value) => value + 1);
  useEffect(() => { let objectUrl = ""; if (!payment.proof_available) { setImageLoading(false); return undefined; } setImageLoading(true); setImageError(""); void fetchAdminCardTransferProof(payment.id).then((url) => { objectUrl = url; setImageUrl(url); }).catch((reason) => setImageError(errorText(reason, "تصویر رسید در دسترس نیست."))).finally(() => setImageLoading(false)); return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); }; }, [payment.id, payment.proof_available, proofReload]);
  useEffect(() => { const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) onClose(); }; window.addEventListener("keydown", closeOnEscape); return () => window.removeEventListener("keydown", closeOnEscape); }, [busy, onClose]);
  async function save() { if (!decision || (decision === "reject" && !note.trim())) return; setBusy(true); setError(""); try { await reviewAdminCardTransferPayment(payment.id, decision, note); onSaved(); } catch (reason) { setError(errorText(reason, "ثبت تصمیم مالی انجام نشد.")); } finally { setBusy(false); } }
  return <div className="payment-review-backdrop" role="presentation" onMouseDown={onClose}><aside className="payment-review-drawer" role="dialog" aria-modal="true" aria-label={`بررسی رسید ${payment.booking_code}`} onMouseDown={(event) => event.stopPropagation()}><header><div><p>بررسی رسید کارت‌به‌کارت</p><h2 dir="ltr">{payment.booking_code}</h2></div><button type="button" onClick={onClose} aria-label="بستن">×</button></header><div className="payment-review-body"><section className="payment-proof-panel"><div className="payment-proof-toolbar"><b>تصویر رسید</b><span><button type="button" disabled={zoom <= 1} onClick={() => setZoom((value) => Math.max(1, value - .25))}>−</button><button type="button" onClick={() => setZoom((value) => Math.min(3, value + .25))}>+</button><button type="button" onClick={() => setZoom(1)}>بازنشانی</button></span></div>{imageLoading ? <LoadingState message="در حال دریافت تصویر امن…" /> : imageError ? <ErrorState message={imageError} onRetry={loadProof} /> : imageUrl ? <div className="payment-proof-canvas"><img src={imageUrl} alt="رسید انتقال مشتری" style={{ transform: `scale(${zoom})` }} /></div> : <EmptyState message="تصویر رسید برای این پرداخت ثبت نشده است." />}</section><section className="payment-review-details"><Status value={payment.status === "paid" ? "پرداخت تأییدشده" : payment.status === "failed" ? "رسید ردشده" : "نیازمند تصمیم"} state={payment.status} /><dl><div><dt>مشتری</dt><dd>{payment.customer.name}<small dir="ltr">{payment.customer.phone}</small></dd></div><div><dt>اقامتگاه</dt><dd>{payment.villa.title}<small>{payment.villa.city}</small></dd></div><div><dt>اقامت</dt><dd>{formatShamsiDate(payment.stay.checkin)} تا {formatShamsiDate(payment.stay.checkout)}</dd></div><div><dt>مبلغ رسید</dt><dd>{money(payment.amount)} تومان</dd></div><div><dt>مانده پس از تأیید</dt><dd>{money(Math.max(0, Number(payment.financials.remaining) - Number(payment.amount)))} تومان</dd></div><div><dt>مرجع بانکی</dt><dd dir="ltr">{payment.reference_id || "—"}</dd></div><div><dt>ارسال رسید</dt><dd>{payment.submitted_at ? shamsiDateTime(payment.submitted_at) : "—"}</dd></div><div><dt>مهلت نگه‌داری</dt><dd>{payment.hold_expires_at ? shamsiDateTime(payment.hold_expires_at) : "—"}</dd></div></dl>{payment.services.length > 0 && <div className="payment-review-services"><h3>خدمات انتخابی</h3>{payment.services.map((service) => <p key={service.title}>{service.title} × {service.quantity.toLocaleString("fa-IR")}<b>{money(service.total_price)} تومان</b></p>)}</div>}{payment.status !== "pending" && <div className="payment-review-note"><h3>نتیجه بررسی</h3><p>{payment.review_note || "یادداشتی ثبت نشده است."}</p><small>{payment.reviewer?.name ?? "—"} · {payment.reviewed_at ? shamsiDateTime(payment.reviewed_at) : "—"}</small></div>}{payment.status === "pending" && <div className="payment-review-actions"><h3>تصمیم مالی</h3>{!decision ? <div><button type="button" onClick={() => setDecision("reject")}>رد رسید</button><button type="button" onClick={() => setDecision("approve")}>تأیید و قطعی‌سازی رزرو</button></div> : <><p>{decision === "approve" ? "با تأیید، پرداخت ثبت می‌شود، رزرو قطعی می‌شود و روزهای اقامت قفل خواهند شد." : "دلیل رد برای مشتری در رسید رزرو نمایش داده می‌شود."}</p>{decision === "reject" && <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="دلیل رد رسید را بنویسید…" rows={4} />}<div><button type="button" onClick={() => setDecision(null)} disabled={busy}>بازگشت</button><button type="button" disabled={busy || (decision === "reject" && !note.trim())} onClick={save}>{busy ? "در حال ثبت…" : decision === "approve" ? "تأیید نهایی" : "ثبت رد رسید"}</button></div></>}</div>}{error && <p className="admin-inline-message" role="alert">{error}</p>}</section></div></aside></div>;
}

function VillaOperations({ onOpenCalendar }: { onOpenCalendar: () => void }) {
  const [items, setItems] = useState<AdminVilla[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [selected, setSelected] = useState<AdminVilla | null>(null);
  const load = () => { setLoading(true); setError(""); fetchAdminVillas().then((value) => setItems(value ?? [])).catch((reason) => setError(errorText(reason, "دریافت ویلاها ناموفق بود."))).finally(() => setLoading(false)); };
  useEffect(load, []);
  return <><section className="admin-panel villa-manager"><div className="panel-head"><div><h2>موجودی اقامتگاه‌ها</h2><p>{loading ? "در حال دریافت…" : `${items.length.toLocaleString("fa-IR")} اقامتگاه`}</p></div>{djangoAdminUrl("villas/villa/add/") && <a href={djangoAdminUrl("villas/villa/add/") ?? "#"} target="_blank">افزودن ویلا</a>}</div>{error ? <ErrorState message={error} onRetry={load} /> : loading ? <LoadingState message="در حال دریافت اقامتگاه‌ها…" /> : items.length ? <div className="admin-villa-grid">{items.map((villa) => <article key={villa.slug}><div className="admin-villa-image">{villa.cover_image ? <img src={villa.cover_image} alt={villa.title} /> : <div className="admin-image-placeholder">بدون تصویر</div>}<span>{villa.status === "published" ? "منتشرشده" : villa.status === "draft" ? "پیش‌نویس" : villa.status === "pending_review" ? "در انتظار بررسی" : "تعلیق‌شده"}</span></div><div className="admin-villa-body"><div><small>{villa.city.name}</small><h2>{villa.title}</h2></div><div className="admin-villa-metrics"><span><small>قیمت پایه</small><b>{money(villa.price_weekday)} تومان</b></span><span><small>ظرفیت</small><b>{villa.capacity.toLocaleString("fa-IR")} نفر</b></span></div><div className="admin-villa-actions"><a href={`/villas/${villa.slug}`} target="_blank">مشاهده</a><button type="button" onClick={() => setSelected(villa)}>ویرایش امن</button><button type="button" onClick={onOpenCalendar}>تقویم</button></div></div></article>)}</div> : <EmptyState message="هنوز اقامتگاهی ثبت نشده است." />}</section>{selected && <VillaEditModal villa={selected} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); load(); }} />}</>;
}

function VillaEditModal({ villa, onClose, onSaved }: { villa: AdminVilla; onClose: () => void; onSaved: () => void }) {
  const confirmAdmin = useAdminConfirm();
  const [form, setForm] = useState(villa); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  function set<K extends keyof AdminVilla>(key: K, value: AdminVilla[K]) { setForm((current) => ({ ...current, [key]: value })); }
  async function save() { if ((form.status === "suspended" || form.status === "draft") && villa.status === "published" && !(await confirmAdmin({ title: "خارج کردن ویلا از انتشار", message: "با تغییر وضعیت، این ویلا از سایت عمومی حذف می‌شود. ادامه می‌دهید؟", confirmLabel: "تغییر وضعیت", tone: "danger" }))) return; setBusy(true); setError(""); try { await updateVillaAdmin(villa.slug, { title: form.title, description: form.description, bedrooms: form.bedrooms, beds: form.beds, bathrooms: form.bathrooms, capacity: form.capacity, price_weekday: form.price_weekday, price_weekend: form.price_weekend, price_holiday: form.price_holiday, deposit_percentage: form.deposit_percentage, is_instant_bookable: form.is_instant_bookable, requires_id_verification: form.requires_id_verification, featured: form.featured, status: form.status, latitude: form.latitude, longitude: form.longitude, map_radius_meters: form.map_radius_meters }); onSaved(); } catch (reason) { setError(errorText(reason, "ذخیره ویلا انجام نشد.")); } finally { setBusy(false); } }
  return <Modal title={`ویرایش ${villa.title}`} onClose={onClose} footer={<><button type="button" onClick={onClose}>انصراف</button><button type="button" disabled={busy || !form.title.trim()} onClick={save}>{busy ? "در حال ذخیره…" : "ذخیره تغییرات"}</button></>}><div className="admin-edit-grid"><Field label="عنوان"><input value={form.title} onChange={(event) => set("title", event.target.value)} /></Field><Field label="وضعیت"><select value={form.status} onChange={(event) => set("status", event.target.value)}><option value="draft">پیش‌نویس</option><option value="pending_review">در انتظار بررسی</option><option value="published">منتشرشده</option><option value="suspended">تعلیق‌شده</option></select></Field><Field label="ظرفیت"><input type="number" min="1" value={form.capacity} onChange={(event) => set("capacity", Number(event.target.value))} /></Field><Field label="اتاق خواب"><input type="number" min="1" value={form.bedrooms} onChange={(event) => set("bedrooms", Number(event.target.value))} /></Field><Field label="تخت"><input type="number" min="1" value={form.beds} onChange={(event) => set("beds", Number(event.target.value))} /></Field><Field label="حمام"><input type="number" min="1" value={form.bathrooms} onChange={(event) => set("bathrooms", Number(event.target.value))} /></Field><Field label="قیمت روز عادی"><input type="number" min="0" value={form.price_weekday} onChange={(event) => set("price_weekday", Number(event.target.value))} /></Field><Field label="قیمت آخر هفته"><input type="number" min="0" value={form.price_weekend} onChange={(event) => set("price_weekend", Number(event.target.value))} /></Field><Field label="قیمت تعطیلات"><input type="number" min="0" value={form.price_holiday} onChange={(event) => set("price_holiday", Number(event.target.value))} /></Field><Field label="درصد بیعانه"><input type="number" min="0" max="100" value={form.deposit_percentage} onChange={(event) => set("deposit_percentage", Number(event.target.value))} /></Field><Field label="عرض جغرافیایی"><input dir="ltr" type="number" step="0.000001" value={form.latitude ?? ""} onChange={(event) => set("latitude", event.target.value ? Number(event.target.value) : null)} /></Field><Field label="طول جغرافیایی"><input dir="ltr" type="number" step="0.000001" value={form.longitude ?? ""} onChange={(event) => set("longitude", event.target.value ? Number(event.target.value) : null)} /></Field><Field label="شعاع موقعیت تقریبی (متر)"><input type="number" min="100" max="5000" value={form.map_radius_meters} onChange={(event) => set("map_radius_meters", Number(event.target.value))} /></Field><Field label="توضیحات" wide><textarea rows={5} value={form.description} onChange={(event) => set("description", event.target.value)} /></Field><label className="check-field"><input type="checkbox" checked={form.featured} onChange={(event) => set("featured", event.target.checked)} /><span>نمایش ویژه</span></label><label className="check-field"><input type="checkbox" checked={form.requires_id_verification} onChange={(event) => set("requires_id_verification", event.target.checked)} /><span>نیازمند احراز هویت</span></label></div>{error && <p className="admin-inline-message">{error}</p>}</Modal>;
}

function CalendarView({ calendarDates }: { calendarDates: string[] }) {
  const confirmAdmin = useAdminConfirm();
  const [query, setQuery] = useState(""); const [filter, setFilter] = useState<"all" | "open" | "blocked" | "booked">("all"); const [villas, setVillas] = useState<VillaListing[]>([]); const [data, setData] = useState<Record<string, ApiAvailabilityDay[]>>({}); const [error, setError] = useState("");
  const load = () => { setError(""); fetchVillas().then(async (rows) => { const live = rows ?? []; const calendars = await Promise.all(live.map((villa) => fetchVillaAvailability(villa.slug, calendarDates[0], addIsoDays(calendarDates[0], calendarDates.length)))); setVillas(live); setData(Object.fromEntries(live.map((villa, index) => [villa.slug, calendars[index] ?? []]))); }).catch((reason) => setError(errorText(reason, "دریافت تقویم ویلاها ناموفق بود."))); };
  useEffect(load, [calendarDates]);
  async function toggle(slug: string, index: number) { const current = data[slug]?.[index]; if (!current || current.status === "booked") return; const next = current.status === "blocked" ? "open" : "blocked"; if (!(await confirmAdmin({ title: next === "blocked" ? "مسدود کردن تاریخ" : "آزاد کردن تاریخ", message: next === "blocked" ? "این روز مسدود شود؟" : "این روز آزاد شود؟", confirmLabel: next === "blocked" ? "مسدود شود" : "آزاد شود", tone: next === "blocked" ? "danger" : "default" }))) return; try { await updateVillaAvailability(slug, calendarDates[index], next); load(); } catch (reason) { setError(errorText(reason, "ذخیره تقویم ناموفق بود.")); } }
  const visible = villas.filter((villa) => (!query.trim() || `${villa.title} ${villa.city}`.toLowerCase().includes(query.trim().toLowerCase())) && (filter === "all" || (data[villa.slug] ?? []).some((day) => day.status === filter)));
  return <>{error && <ErrorState message={error} onRetry={load} />}<div className="calendar-toolbar"><div><h2>تقویم ۳۰ روز آینده</h2></div><div className="calendar-legend"><span><i className="booked" />رزروشده</span><span><i className="blocked" />مسدود</span><span><i />آزاد</span></div></div><div className="calendar-filters"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جست‌وجوی ویلا یا شهر…" /><select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}><option value="all">همه وضعیت‌ها</option><option value="open">دارای روز آزاد</option><option value="blocked">دارای روز بسته</option><option value="booked">دارای رزرو</option></select></div><section className="admin-calendar" style={{ gridTemplateColumns: `200px repeat(${calendarDates.length}, minmax(46px, 1fr))` }}><div className="calendar-corner"><span>{visible.length.toLocaleString("fa-IR")} ویلا</span><small>۳۰ روز آینده</small></div>{calendarDates.map((day) => <div className="calendar-date" key={day}><span>{new Intl.DateTimeFormat("fa-IR", { weekday: "short" }).format(new Date(`${day}T12:00:00`))}</span><b>{formatShamsiDate(day).split("/")[2]}</b></div>)}{visible.map((villa) => <div className="calendar-row" key={villa.slug}><div className="calendar-villa">{villa.image && <img src={villa.image} alt="" />}<div><strong>{villa.title}</strong><small>{villa.city}</small></div></div>{calendarDates.map((day, index) => { const state = data[villa.slug]?.[index]?.status ?? "open"; return <button type="button" className={`calendar-cell ${state}`} key={day} disabled={state === "booked"} onClick={() => toggle(villa.slug, index)} aria-label={`${villa.title} ${formatShamsiDate(day)}`}><span>{state === "booked" ? "رزرو" : state === "blocked" ? "بسته" : ""}</span>{state === "open" && <small>{Math.round(villa.price / 1_000_000).toLocaleString("fa-IR")}م</small>}</button>; })}</div>)}</section><p className="calendar-hint">روزهای رزروشده از این نما قابل تغییر نیستند.</p></>;
}

function BulkAvailabilityPanel() {
  const confirmAdmin = useAdminConfirm();
  const [villas, setVillas] = useState<VillaListing[]>([]); const [slug, setSlug] = useState(""); const [start, setStart] = useState(""); const [end, setEnd] = useState(""); const [status, setStatus] = useState<"open" | "blocked">("blocked"); const [priceDate, setPriceDate] = useState(""); const [price, setPrice] = useState(""); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  useEffect(() => { fetchVillas().then((rows) => { setVillas(rows ?? []); setSlug(rows?.[0]?.slug ?? ""); }).catch((reason) => setMessage(errorText(reason, "فهرست ویلاها دریافت نشد."))); }, []);
  function range(from: string, to: string) { if (!from || !to || to < from) return []; const result: string[] = []; const cursor = new Date(`${from}T12:00:00`); const finish = new Date(`${to}T12:00:00`); while (cursor <= finish && result.length < 180) { result.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`); cursor.setDate(cursor.getDate() + 1); } return result; }
  async function save() { const days = range(start, end); if (!slug || !days.length) { setMessage("ویلا و بازه تاریخ معتبر را انتخاب کنید."); return; } if (!(await confirmAdmin({ title: "ویرایش گروهی تقویم", message: `${days.length.toLocaleString("fa-IR")} روز ${status === "blocked" ? "مسدود" : "آزاد"} شود؟`, confirmLabel: "اعمال تغییرات", tone: status === "blocked" ? "danger" : "default" }))) return; setBusy(true); setMessage(""); try { await bulkUpdateVillaAvailability(slug, days, status); if (priceDate && price) await updateVillaPriceOverride(slug, priceDate, Number(price)); setMessage("تغییرات تقویم ذخیره شد."); } catch (reason) { setMessage(errorText(reason, "ذخیره تغییرات انجام نشد.")); } finally { setBusy(false); } }
  return <section className="admin-panel calendar-bulk-panel"><div className="panel-head"><div><h2>ویرایش گروهی تقویم و قیمت</h2><p>همه تاریخ‌ها در رابط کاربری شمسی هستند.</p></div></div><div className="calendar-bulk-form"><Field label="ویلا"><select value={slug} onChange={(event) => setSlug(event.target.value)}>{villas.map((villa) => <option key={villa.slug} value={villa.slug}>{villa.title}</option>)}</select></Field><ShamsiDateField label="از تاریخ" value={start} minValue={isoToday()} onChange={setStart} /><ShamsiDateField label="تا تاریخ" value={end} minValue={start || isoToday()} onChange={setEnd} /><Field label="وضعیت"><select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="blocked">مسدود</option><option value="open">آزاد</option></select></Field><Field label="قیمت ویژه"><input type="number" min="0" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="اختیاری" /></Field><ShamsiDateField label="تاریخ قیمت ویژه" value={priceDate} minValue={isoToday()} onChange={setPriceDate} /><button type="button" disabled={busy || !slug} onClick={save}>{busy ? "در حال ذخیره…" : "ذخیره تغییرات"}</button></div>{message && <p className="admin-inline-message" role="status">{message}</p>}</section>;
}

const serviceStatusLabels: Record<AdminBookingService["status"], string> = { requested: "در انتظار هماهنگی", confirmed: "تأییدشده", unavailable: "غیرقابل ارائه", completed: "انجام‌شده", cancelled: "لغوشده" };
const servicePricingLabels: Record<AdminServiceOffer["pricing_model"], string> = { fixed: "ثابت", per_guest: "هر مهمان", per_night: "هر شب", per_unit: "هر واحد" };

function ServiceOperations() {
  const [tab, setTab] = useState<"fulfilment" | "catalogue" | "calendar">("fulfilment");
  const [services, setServices] = useState<AdminServiceOffer[]>([]);
  const [villas, setVillas] = useState<AdminVilla[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [query, setQuery] = useState(""); const [appliedQuery, setAppliedQuery] = useState("");
  const [selected, setSelected] = useState<AdminServiceOffer | null>(null);
  const load = useCallback(() => { setLoading(true); setError(""); Promise.all([fetchAdminServices(appliedQuery), fetchAdminVillas()]).then(([rows, villaRows]) => { setServices(rows ?? []); setVillas(villaRows ?? []); }).catch((reason) => setError(errorText(reason, "دریافت خدمات ناموفق بود."))).finally(() => setLoading(false)); }, [appliedQuery]);
  useEffect(load, [load]);
  return <>
    <section className="admin-panel service-ops-header"><div><p>عملیات خدمات تکمیلی</p><h2>از انتشار تا تحویل خدمت</h2><span>خدمات رزروشده، ظرفیت روزانه و محتوای قابل نمایش را از یک محل مدیریت کنید.</span></div><div className="service-ops-tabs" role="tablist"><button role="tab" aria-selected={tab === "fulfilment"} className={tab === "fulfilment" ? "active" : ""} onClick={() => setTab("fulfilment")}>صف اجرا</button><button role="tab" aria-selected={tab === "catalogue"} className={tab === "catalogue" ? "active" : ""} onClick={() => setTab("catalogue")}>کاتالوگ</button><button role="tab" aria-selected={tab === "calendar"} className={tab === "calendar" ? "active" : ""} onClick={() => setTab("calendar")}>ظرفیت و قیمت</button></div></section>
    {tab === "fulfilment" && <ServiceFulfilmentQueue services={services} />}
    {tab === "catalogue" && <section className="admin-panel"><div className="panel-head"><div><h2>کاتالوگ خدمات</h2><p>{services.length.toLocaleString("fa-IR")} خدمت ثبت‌شده</p></div><form className="admin-filters" onSubmit={(event) => { event.preventDefault(); setAppliedQuery(query); }}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="نام یا دسته‌بندی…"/><button type="submit">جست‌وجو</button></form></div>{error ? <ErrorState message={error} onRetry={load}/> : loading ? <LoadingState message="در حال دریافت کاتالوگ…"/> : services.length ? <div className="booking-table-wrap"><table className="admin-table service-admin-table"><thead><tr><th>خدمت</th><th>شیوه ارائه</th><th>قیمت پایه</th><th>ظرفیت</th><th>رزروها</th><th>انتشار</th><th/></tr></thead><tbody>{services.map((service) => <tr key={service.slug}><td><div className="service-admin-identity">{service.cover_image ? <img src={service.cover_image} alt=""/> : <span>V1</span>}<p><b>{service.title}</b><small>{service.category}</small></p></div></td><td>{service.fulfillment_mode === "bookable" ? "قابل رزرو" : service.fulfillment_mode === "both" ? "رزرو و درخواست" : "فقط درخواست"}<small>{servicePricingLabels[service.pricing_model]}</small></td><td>{money(service.base_price)} تومان</td><td>{service.default_daily_capacity.toLocaleString("fa-IR")} سفارش روزانه</td><td>{service.reservation_count.toLocaleString("fa-IR")}</td><td><Status value={service.status === "published" ? "منتشرشده" : service.status === "archived" ? "بایگانی" : "پیش‌نویس"} state={service.status}/>{service.featured && <small>ویژه</small>}</td><td><button type="button" onClick={() => setSelected(service)}>ویرایش</button></td></tr>)}</tbody></table></div> : <EmptyState message="خدمتی ثبت نشده است؛ محتوای جدید را از مدیریت محتوای Django ایجاد کنید."/>}</section>}
    {tab === "calendar" && <ServiceAvailabilityOperations services={services}/>}
    {selected && <ServiceEditor
      service={selected}
      villas={villas}
      onClose={() => setSelected(null)}
      onSaved={() => { setSelected(null); load(); }}
    />}
  </>;
}

function ServiceEditor({ service, villas, onClose, onSaved }: { service: AdminServiceOffer; villas: AdminVilla[]; onClose: () => void; onSaved: () => void }) {
  const confirm = useAdminConfirm(); const [draft, setDraft] = useState(service); const [features, setFeatures] = useState(service.features.join("\n")); const [inclusions, setInclusions] = useState(service.inclusions.join("\n")); const [exclusions, setExclusions] = useState(service.exclusions.join("\n")); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const change = <K extends keyof AdminServiceOffer>(key: K, value: AdminServiceOffer[K]) => setDraft((current) => ({ ...current, [key]: value }));
  async function save() {
    if (!draft.title.trim() || !draft.category.trim() || Number(draft.base_price) < 0) { setError("نام، دسته‌بندی و قیمت معتبر را کامل کنید."); return; }
    if (draft.status === "archived" && service.status !== "archived" && !await confirm({ title: "بایگانی خدمت", message: "این خدمت فوراً از کاتالوگ عمومی و انتخاب رزرو خارج می‌شود.", confirmLabel: "بایگانی", tone: "danger" })) return;
    setBusy(true); setError("");
    try { await updateAdminService(service.slug, { ...draft, features: features.split("\n").map((v) => v.trim()).filter(Boolean), inclusions: inclusions.split("\n").map((v) => v.trim()).filter(Boolean), exclusions: exclusions.split("\n").map((v) => v.trim()).filter(Boolean) }); onSaved(); }
    catch (reason) { setError(errorText(reason, "ذخیره خدمت ناموفق بود.")); }
    finally { setBusy(false); }
  }
  return <Modal title={`ویرایش ${service.title}`} onClose={onClose} footer={<><button type="button" onClick={onClose}>انصراف</button><button type="button" disabled={busy} onClick={save}>{busy ? "در حال ذخیره…" : "ذخیره تغییرات"}</button></>}><div className="admin-edit-grid service-editor-grid"><Field label="نام خدمت"><input value={draft.title} onChange={(e) => change("title", e.target.value)}/></Field><Field label="دسته‌بندی"><input value={draft.category} onChange={(e) => change("category", e.target.value)}/></Field><Field label="توضیح کوتاه" wide><input value={draft.short_description} maxLength={220} onChange={(e) => change("short_description", e.target.value)}/></Field><Field label="شرح کامل" wide><textarea rows={5} value={draft.description} onChange={(e) => change("description", e.target.value)}/></Field><Field label="تصویر شاخص (URL)" wide><input dir="ltr" value={draft.cover_image} onChange={(e) => change("cover_image", e.target.value)}/></Field><Field label="قیمت پایه"><input dir="ltr" type="number" min="0" value={draft.base_price} onChange={(e) => change("base_price", e.target.value)}/></Field><Field label="یادداشت قیمت"><input value={draft.price_note} onChange={(e) => change("price_note", e.target.value)}/></Field><Field label="مدل قیمت"><select value={draft.pricing_model} onChange={(e) => change("pricing_model", e.target.value as AdminServiceOffer["pricing_model"])}><option value="fixed">ثابت</option><option value="per_guest">هر مهمان</option><option value="per_night">هر شب</option><option value="per_unit">هر واحد</option></select></Field><Field label="شیوه ارائه"><select value={draft.fulfillment_mode} onChange={(e) => change("fulfillment_mode", e.target.value as AdminServiceOffer["fulfillment_mode"])}><option value="bookable">قابل رزرو</option><option value="both">رزرو و درخواست</option><option value="inquiry_only">فقط درخواست</option></select></Field><Field label="زمان‌بندی"><select value={draft.schedule_type} onChange={(e) => change("schedule_type", e.target.value as AdminServiceOffer["schedule_type"])}><option value="none">بدون انتخاب روز</option><option value="stay_date">یکی از روزهای اقامت</option><option value="checkin">روز ورود</option><option value="checkout">روز خروج</option></select></Field><Field label="حداقل زمان هماهنگی"><input type="number" min="0" value={draft.minimum_lead_hours} onChange={(e) => change("minimum_lead_hours", Number(e.target.value))}/></Field><Field label="ظرفیت روزانه"><input type="number" min="1" value={draft.default_daily_capacity} onChange={(e) => change("default_daily_capacity", Number(e.target.value))}/></Field><Field label="واحد"><input value={draft.unit_label} onChange={(e) => change("unit_label", e.target.value)}/></Field><Field label="حداقل تعداد"><input type="number" min="1" value={draft.minimum_quantity} onChange={(e) => change("minimum_quantity", Number(e.target.value))}/></Field><Field label="حداکثر تعداد"><input type="number" min="1" value={draft.maximum_quantity} onChange={(e) => change("maximum_quantity", Number(e.target.value))}/></Field><Field label="ترتیب نمایش"><input type="number" min="0" value={draft.sort_order} onChange={(e) => change("sort_order", Number(e.target.value))}/></Field><Field label="وضعیت انتشار"><select value={draft.status} onChange={(e) => change("status", e.target.value as AdminServiceOffer["status"])}><option value="draft">پیش‌نویس</option><option value="published">منتشرشده</option><option value="archived">بایگانی</option></select></Field><Field label="ویلاهای مجاز (خالی یعنی همه)" wide><select multiple size={Math.min(6, Math.max(3, villas.length))} value={draft.eligible_villa_slugs} onChange={(e) => change("eligible_villa_slugs", Array.from(e.target.selectedOptions, (option) => option.value))}>{villas.map((villa) => <option value={villa.slug} key={villa.slug}>{villa.title}</option>)}</select></Field><Field label="ویژگی‌ها (هر خط یک مورد)" wide><textarea rows={4} value={features} onChange={(e) => setFeatures(e.target.value)}/></Field><Field label="موارد شامل‌شده" wide><textarea rows={4} value={inclusions} onChange={(e) => setInclusions(e.target.value)}/></Field><Field label="موارد خارج از خدمت" wide><textarea rows={4} value={exclusions} onChange={(e) => setExclusions(e.target.value)}/></Field><Field label="نکات آماده‌سازی" wide><textarea rows={3} value={draft.preparation_notes} onChange={(e) => change("preparation_notes", e.target.value)}/></Field><Field label="شرایط لغو" wide><textarea rows={3} value={draft.cancellation_text} onChange={(e) => change("cancellation_text", e.target.value)}/></Field><label className="admin-checkbox"><input type="checkbox" checked={draft.featured} onChange={(e) => change("featured", e.target.checked)}/> نمایش به‌عنوان خدمت ویژه</label></div>{error && <p className="admin-inline-message" role="alert">{error}</p>}</Modal>;
}

function ServiceFulfilmentQueue({ services }: { services: AdminServiceOffer[] }) {
  const [items, setItems] = useState<AdminBookingService[]>([]); const [status, setStatus] = useState("requested"); const [service, setService] = useState(""); const [query, setQuery] = useState(""); const [appliedQuery, setAppliedQuery] = useState(""); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [selected, setSelected] = useState<AdminBookingService | null>(null);
  const load = useCallback(() => { setLoading(true); setError(""); fetchAdminBookingServices({ status, service, query: appliedQuery }).then((rows) => setItems(rows ?? [])).catch((reason) => setError(errorText(reason, "دریافت صف اجرای خدمات ناموفق بود."))).finally(() => setLoading(false)); }, [status, service, appliedQuery]); useEffect(load, [load]);
  return <><section className="admin-panel"><div className="panel-head"><div><h2>صف اجرای خدمات رزرو</h2><p>{items.length.toLocaleString("fa-IR")} مورد با فیلتر فعلی</p></div><form className="admin-filters" onSubmit={(e) => { e.preventDefault(); setAppliedQuery(query); }}><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="کد رزرو، مهمان یا ویلا…"/><select value={service} onChange={(e) => setService(e.target.value)}><option value="">همه خدمات</option>{services.map((row) => <option value={row.slug} key={row.slug}>{row.title}</option>)}</select><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="requested">در انتظار</option><option value="confirmed">تأییدشده</option><option value="completed">انجام‌شده</option><option value="unavailable">غیرقابل ارائه</option><option value="cancelled">لغوشده</option><option value="all">همه</option></select><button type="submit">جست‌وجو</button></form></div>{error ? <ErrorState message={error} onRetry={load}/> : loading ? <LoadingState message="در حال دریافت صف خدمات…"/> : items.length ? <div className="booking-table-wrap"><table className="admin-table"><thead><tr><th>خدمت</th><th>رزرو و مهمان</th><th>زمان اجرا</th><th>مبلغ</th><th>وضعیت</th><th/></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><b>{item.title}</b><small>{item.quantity.toLocaleString("fa-IR")} {item.unit_label || "واحد"}</small></td><td><b dir="ltr">{item.booking_code}</b><small>{item.customer.name} · {item.villa.title}</small></td><td>{item.service_date ? formatShamsiDate(item.service_date) : "—"}<small>{item.time_slot || "زمان منعطف"}</small></td><td>{money(item.total_price)} تومان</td><td><Status value={serviceStatusLabels[item.status]} state={item.status}/></td><td><button type="button" onClick={() => setSelected(item)}>پیگیری</button></td></tr>)}</tbody></table></div> : <EmptyState message="موردی در صف اجرای خدمات نیست."/>}</section>{selected && <ServiceFulfilmentDrawer item={selected} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); load(); }}/>}</>;
}

function ServiceFulfilmentDrawer({ item, onClose, onSaved }: { item: AdminBookingService; onClose: () => void; onSaved: () => void }) {
  const confirm = useAdminConfirm(); const [status, setStatus] = useState(item.status); const [note, setNote] = useState(item.admin_note); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const allowed = item.status === "requested" ? ["requested", "confirmed", "unavailable", "cancelled"] : item.status === "confirmed" ? ["confirmed", "completed", "cancelled"] : [item.status];
  async function save() { if (["unavailable", "cancelled"].includes(status) && !note.trim()) { setError("برای لغو یا عدم امکان ارائه، دلیل داخلی را بنویسید."); return; } if (["unavailable", "cancelled"].includes(status) && !await confirm({ title: "تغییر وضعیت خدمت", message: "این تغییر ممکن است نیازمند تماس با مهمان و اصلاح مالی رزرو باشد.", confirmLabel: "ثبت تغییر", tone: "danger" })) return; setBusy(true); setError(""); try { await updateAdminBookingService(item.id, { status, admin_note: note }); onSaved(); } catch (reason) { setError(errorText(reason, "ثبت پیگیری خدمت ناموفق بود.")); } finally { setBusy(false); } }
  return <Modal title={`خدمت ${item.title}`} onClose={onClose} footer={<><button type="button" onClick={onClose}>بستن</button><button type="button" disabled={busy || (status === item.status && note === item.admin_note)} onClick={save}>{busy ? "در حال ثبت…" : "ذخیره پیگیری"}</button></>}><dl><div><dt>کد رزرو</dt><dd dir="ltr">{item.booking_code}</dd></div><div><dt>مهمان</dt><dd>{item.customer.name} · <span dir="ltr">{item.customer.phone}</span></dd></div><div><dt>ویلا</dt><dd>{item.villa.title}، {item.villa.city}</dd></div><div><dt>اقامت</dt><dd>{formatShamsiDate(item.stay.checkin)} تا {formatShamsiDate(item.stay.checkout)}</dd></div><div><dt>تاریخ خدمت</dt><dd>{item.service_date ? formatShamsiDate(item.service_date) : "—"}</dd></div><div><dt>مبلغ</dt><dd>{money(item.total_price)} تومان</dd></div></dl>{item.customer_note && <><h3>یادداشت مهمان</h3><p>{item.customer_note}</p></>}<div className="admin-edit-grid"><Field label="وضعیت"><select value={status} onChange={(e) => setStatus(e.target.value as AdminBookingService["status"])}>{allowed.map((value) => <option value={value} key={value}>{serviceStatusLabels[value as AdminBookingService["status"]]}</option>)}</select></Field><Field label="یادداشت داخلی" wide><textarea rows={5} value={note} onChange={(e) => setNote(e.target.value)} placeholder="نتیجه تماس، جزئیات اجرا یا علت عدم ارائه…"/></Field></div>{error && <p className="admin-inline-message" role="alert">{error}</p>}</Modal>;
}

function ServiceAvailabilityOperations({ services }: { services: AdminServiceOffer[] }) {
  const confirm = useAdminConfirm(); const [slug, setSlug] = useState(""); const [start, setStart] = useState(isoToday()); const [days, setDays] = useState<ServiceAvailabilityDay[]>([]); const [selected, setSelected] = useState<string[]>([]); const [state, setState] = useState<ServiceAvailabilityDay["status"]>("blocked"); const [capacity, setCapacity] = useState(""); const [price, setPrice] = useState(""); const [note, setNote] = useState(""); const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  useEffect(() => { if (!slug && services.length) setSlug(services[0].slug); }, [services, slug]);
  const load = useCallback(() => { if (!slug) return; setLoading(true); setError(""); fetchAdminServiceAvailability(slug, start, 30).then((row) => setDays(row?.days ?? [])).catch((reason) => setError(errorText(reason, "دریافت تقویم خدمت ناموفق بود."))).finally(() => setLoading(false)); }, [slug, start]); useEffect(load, [load]);
  async function apply() { if (!selected.length) { setError("حداقل یک روز را انتخاب کنید."); return; } if (state !== "available" && !await confirm({ title: "محدودکردن ظرفیت خدمت", message: `${selected.length.toLocaleString("fa-IR")} روز انتخاب‌شده برای سفارش جدید بسته می‌شود.`, confirmLabel: "اعمال تغییر", tone: "danger" })) return; setLoading(true); setError(""); try { await updateAdminServiceAvailability(slug, { dates:selected, status:state, capacity_override:capacity ? Number(capacity) : null, price_override:price ? Number(price) : null, admin_note:note }); setSelected([]); load(); } catch (reason) { setError(errorText(reason, "به‌روزرسانی تقویم ناموفق بود.")); setLoading(false); } }
  return <section className="admin-panel service-capacity-panel"><div className="panel-head"><div><h2>ظرفیت و قیمت روزانه</h2><p>روزها را انتخاب و تغییرات را گروهی اعمال کنید.</p></div><div className="admin-filters"><select value={slug} onChange={(e) => { setSlug(e.target.value); setSelected([]); }}>{services.map((row) => <option value={row.slug} key={row.slug}>{row.title}</option>)}</select><ShamsiDateField label="شروع بازه" value={start} minValue={isoToday()} onChange={setStart}/></div></div>{error && <p className="admin-inline-message" role="alert">{error}</p>}{loading && !days.length ? <LoadingState message="در حال دریافت ظرفیت…"/> : days.length ? <><div className="service-capacity-grid">{days.map((day) => <button type="button" key={day.date} className={`${day.status} ${selected.includes(day.date) ? "selected" : ""} ${day.reserved ? "has-reservation" : ""}`} onClick={() => setSelected((current) => current.includes(day.date) ? current.filter((date) => date !== day.date) : [...current, day.date])}><span>{formatShamsiDate(day.date)}</span><b>{day.reserved.toLocaleString("fa-IR")} / {day.capacity.toLocaleString("fa-IR")}</b><small>{day.status === "available" ? "باز" : day.status === "blocked" ? "مسدود" : "تعطیل"}{day.price_override ? ` · ${money(day.price_override)} تومان` : ""}</small></button>)}</div><div className="service-capacity-actions"><p><b>{selected.length.toLocaleString("fa-IR")}</b> روز انتخاب شده</p><Field label="وضعیت"><select value={state} onChange={(e) => setState(e.target.value as ServiceAvailabilityDay["status"])}><option value="available">باز</option><option value="blocked">مسدود</option><option value="closed">تعطیل</option></select></Field><Field label="ظرفیت اختصاصی"><input type="number" min="1" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="پیش‌فرض"/></Field><Field label="قیمت اختصاصی"><input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="قیمت پایه"/></Field><Field label="یادداشت"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="علت تغییر…"/></Field><button type="button" disabled={loading || !selected.length} onClick={apply}>اعمال روی روزهای انتخابی</button></div></> : <EmptyState message="تقویم این خدمت در دسترس نیست."/>}</section>;
}

function ContractorOperations() {
  const [items, setItems] = useState<AdminContractor[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [query, setQuery] = useState(""); const [selected, setSelected] = useState<AdminContractor | null>(null);
  const load = () => { setLoading(true); setError(""); fetchAdminContractors().then((value) => setItems(value ?? [])).catch((reason) => setError(errorText(reason, "دریافت پیمانکاران انجام نشد."))).finally(() => setLoading(false)); };
  useEffect(load, []); const visible = items.filter((item) => !query.trim() || `${item.name} ${item.city} ${item.specialty}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <><section className="admin-panel"><div className="panel-head"><div><h2>کاتالوگ پیمانکاران</h2><p>{visible.length.toLocaleString("fa-IR")} پروفایل</p></div><input className="admin-live-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="نام، شهر یا تخصص…" /></div>{error ? <ErrorState message={error} onRetry={load} /> : loading ? <LoadingState message="در حال دریافت پیمانکاران…" /> : visible.length ? <div className="booking-table-wrap"><table className="admin-table"><thead><tr><th>نام</th><th>تخصص</th><th>شهر</th><th>انتشار</th><th>اعتماد</th><th>درخواست</th><th /></tr></thead><tbody>{visible.map((item) => <tr key={item.slug}><td>{item.name}</td><td>{item.specialty}</td><td>{item.city}</td><td>{item.status === "published" ? "منتشرشده" : item.status === "draft" ? "پیش‌نویس" : "بایگانی"}</td><td>{item.verified ? "تأییدشده" : "تأییدنشده"}{item.featured ? " · ویژه" : ""}</td><td>{item.inquiry_count.toLocaleString("fa-IR")}</td><td><button type="button" onClick={() => setSelected(item)}>ویرایش</button></td></tr>)}</tbody></table></div> : <EmptyState message="پروفایلی ثبت نشده است." />}</section>{selected && <ContractorEditModal contractor={selected} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); load(); }} />}</>;
}

function ContractorEditModal({ contractor, onClose, onSaved }: { contractor: AdminContractor; onClose: () => void; onSaved: () => void }) {
  const confirmAdmin = useAdminConfirm();
  const [form, setForm] = useState(contractor); const [services, setServices] = useState(contractor.services.join("، ")); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); function set<K extends keyof AdminContractor>(key: K, value: AdminContractor[K]) { setForm((current) => ({ ...current, [key]: value })); }
  async function save() { if (contractor.status !== form.status && !(await confirmAdmin({ title: "تغییر وضعیت انتشار", message: "وضعیت انتشار پروفایل تغییر کند؟", confirmLabel: "تغییر وضعیت", tone: form.status === "archived" ? "danger" : "default" }))) return; setBusy(true); setError(""); try { await updateAdminContractor(contractor.slug, { name: form.name, specialty: form.specialty, city: form.city, years_experience: form.years_experience, description: form.description, services: services.split(/[،,]/).map((item) => item.trim()).filter(Boolean), cover_image: form.cover_image, verified: form.verified, featured: form.featured, status: form.status }); onSaved(); } catch (reason) { setError(errorText(reason, "ذخیره پیمانکار انجام نشد.")); } finally { setBusy(false); } }
  return <Modal title={`ویرایش ${contractor.name}`} onClose={onClose} footer={<><button type="button" onClick={onClose}>انصراف</button><button type="button" disabled={busy} onClick={save}>{busy ? "در حال ذخیره…" : "ذخیره تغییرات"}</button></>}><div className="admin-edit-grid"><Field label="نام"><input value={form.name} onChange={(event) => set("name", event.target.value)} /></Field><Field label="تخصص"><input value={form.specialty} onChange={(event) => set("specialty", event.target.value)} /></Field><Field label="شهر"><input value={form.city} onChange={(event) => set("city", event.target.value)} /></Field><Field label="سال تجربه"><input type="number" min="0" value={form.years_experience} onChange={(event) => set("years_experience", Number(event.target.value))} /></Field><Field label="خدمات" wide><input value={services} onChange={(event) => setServices(event.target.value)} /></Field><Field label="معرفی" wide><textarea rows={5} value={form.description} onChange={(event) => set("description", event.target.value)} /></Field><Field label="وضعیت"><select value={form.status} onChange={(event) => set("status", event.target.value as AdminContractor["status"])}><option value="draft">پیش‌نویس</option><option value="published">منتشرشده</option><option value="archived">بایگانی</option></select></Field><label className="check-field"><input type="checkbox" checked={form.verified} onChange={(event) => set("verified", event.target.checked)} /><span>تأیید ویلاوان</span></label><label className="check-field"><input type="checkbox" checked={form.featured} onChange={(event) => set("featured", event.target.checked)} /><span>نمایش ویژه</span></label></div>{error && <p className="admin-inline-message">{error}</p>}</Modal>;
}

function LeadOperations() {
  const [items, setItems] = useState<AdminInquiry[]>([]); const [contractors, setContractors] = useState<AdminContractor[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [kind, setKind] = useState<"all" | AdminInquiry["kind"]>("all"); const [selected, setSelected] = useState<AdminInquiry | null>(null);
  const load = () => { setLoading(true); setError(""); Promise.all([fetchAdminInquiries(kind === "all" ? undefined : kind), fetchAdminContractors()]).then(([leads, people]) => { setItems(leads ?? []); setContractors((people ?? []).filter((item) => item.status === "published")); }).catch((reason) => setError(errorText(reason, "دریافت درخواست‌ها ناموفق بود."))).finally(() => setLoading(false)); };
  useEffect(load, [kind]);
  return <><section className="admin-panel"><div className="panel-head"><div><h2>صف پیگیری بازار</h2><p>{items.filter((item) => item.status !== "closed").length.toLocaleString("fa-IR")} درخواست باز</p></div><select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}><option value="all">همه درخواست‌ها</option><option value="contractor">پیمانکار</option><option value="real_estate">ملک</option><option value="service">خدمات سفر</option></select></div>{error ? <ErrorState message={error} onRetry={load} /> : loading ? <LoadingState message="در حال دریافت درخواست‌ها…" /> : items.length ? <div className="booking-table-wrap"><table className="admin-table"><thead><tr><th>مشتری</th><th>نوع</th><th>درخواست</th><th>وضعیت</th><th>مسئول معرفی</th><th>پیگیری</th><th /></tr></thead><tbody>{items.map((item) => { const overdue = item.follow_up_at && new Date(item.follow_up_at) < new Date() && item.status !== "closed"; return <tr key={item.id} className={overdue ? "is-overdue" : ""}><td>{item.name}<small dir="ltr">{item.phone}</small></td><td>{item.kind === "contractor" ? "پیمانکار" : item.kind === "real_estate" ? "ملک" : "خدمات"}</td><td>{item.target}</td><td>{inquiryLabels[item.status]}</td><td>{item.assigned_contractor?.name ?? "—"}</td><td>{item.follow_up_at ? shamsiDateTime(item.follow_up_at) : "تعیین نشده"}</td><td><button type="button" onClick={() => setSelected(item)}>پیگیری</button></td></tr>; })}</tbody></table></div> : <EmptyState message="درخواستی ثبت نشده است." />}</section>{selected && <LeadEditModal lead={selected} contractors={contractors} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); load(); }} />}</>;
}

function LeadEditModal({ lead, contractors, onClose, onSaved }: { lead: AdminInquiry; contractors: AdminContractor[]; onClose: () => void; onSaved: () => void }) {
  const confirmAdmin = useAdminConfirm();
  const [status, setStatus] = useState(lead.status); const [assigned, setAssigned] = useState(lead.assigned_contractor?.slug ?? ""); const [followUp, setFollowUp] = useState(lead.follow_up_at?.slice(0, 10) ?? ""); const [note, setNote] = useState(lead.admin_note); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const contractorTransitions: Record<AdminInquiry["status"], AdminInquiry["status"][]> = { new: ["new", "contacted"], contacted: ["contacted", "introduced"], introduced: ["introduced", "closed"], closed: ["closed"] };
  const statuses = lead.kind === "contractor" ? contractorTransitions[lead.status] : (["new", "contacted", "introduced", "closed"] as AdminInquiry["status"][]);
  async function save() { if (status === "closed" && !(await confirmAdmin({ title: "بستن پیگیری", message: "این پیگیری بسته شود؟", confirmLabel: "بستن پیگیری", tone: "danger" }))) return; setBusy(true); setError(""); try { await updateAdminInquiry(lead.id, { status, admin_note: note, follow_up_at: followUp ? `${followUp}T09:00:00+03:30` : null, assigned_contractor_slug: lead.kind === "contractor" ? assigned || null : undefined }); onSaved(); } catch (reason) { setError(errorText(reason, "ذخیره پیگیری انجام نشد.")); } finally { setBusy(false); } }
  return <Modal title={`پیگیری ${lead.name}`} onClose={onClose} footer={<><button type="button" onClick={onClose}>انصراف</button><button type="button" disabled={busy} onClick={save}>{busy ? "در حال ذخیره…" : "ذخیره پیگیری"}</button></>}><dl><div><dt>تماس</dt><dd dir="ltr">{lead.phone}</dd></div><div><dt>درخواست</dt><dd>{lead.target}</dd></div></dl><h3>شرح مشتری</h3><p>{lead.message || "بدون توضیح"}</p><div className="admin-edit-grid"><Field label="وضعیت"><select value={status} onChange={(event) => setStatus(event.target.value as AdminInquiry["status"])}>{statuses.map((value) => <option key={value} value={value}>{inquiryLabels[value]}</option>)}</select></Field>{lead.kind === "contractor" && <Field label="پیمانکار اصلی"><select value={assigned} onChange={(event) => setAssigned(event.target.value)}><option value="">انتخاب نشده</option>{contractors.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}</select></Field>}<ShamsiDateField label="تاریخ پیگیری" value={followUp} minValue={isoToday()} onChange={setFollowUp} /><Field label="یادداشت داخلی" wide><textarea rows={5} value={note} onChange={(event) => setNote(event.target.value)} /></Field></div>{error && <p className="admin-inline-message">{error}</p>}</Modal>;
}

function SupportOperations() {
  const [items, setItems] = useState<AdminSupportTicket[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [selected, setSelected] = useState<AdminSupportTicket | null>(null);
  const load = () => { setLoading(true); setError(""); fetchAdminSupportTickets().then((value) => setItems(value ?? [])).catch((reason) => setError(errorText(reason, "دریافت تیکت‌ها ناموفق بود."))).finally(() => setLoading(false)); };
  useEffect(load, []);
  return <><section className="admin-panel"><div className="panel-head"><div><h2>تیکت‌های پشتیبانی</h2><p>{items.filter((item) => item.status !== "closed").length.toLocaleString("fa-IR")} مورد باز</p></div></div>{error ? <ErrorState message={error} onRetry={load} /> : loading ? <LoadingState message="در حال دریافت تیکت‌ها…" /> : items.length ? <div className="booking-table-wrap"><table className="admin-table"><thead><tr><th>مشتری</th><th>موضوع</th><th>رزرو</th><th>وضعیت</th><th>آخرین تغییر</th><th /></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td>{item.customer.name}<small dir="ltr">{item.customer.phone}</small></td><td>{item.subject}</td><td dir="ltr">{item.booking_code ?? "—"}</td><td>{supportLabels[item.status]}</td><td>{shamsiDateTime(item.updated_at)}</td><td><button type="button" onClick={() => setSelected(item)}>پاسخ و پیگیری</button></td></tr>)}</tbody></table></div> : <EmptyState message="تیکتی ثبت نشده است." />}</section>{selected && <SupportEditModal ticket={selected} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); load(); }} />}</>;
}

function SupportEditModal({ ticket, onClose, onSaved }: { ticket: AdminSupportTicket; onClose: () => void; onSaved: () => void }) {
  const confirmAdmin = useAdminConfirm();
  const [status, setStatus] = useState(ticket.status); const [response, setResponse] = useState(ticket.admin_response); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function save() { if (status === "closed" && !(await confirmAdmin({ title: "بستن تیکت پشتیبانی", message: "این تیکت بسته شود؟", confirmLabel: "بستن تیکت", tone: "danger" }))) return; setBusy(true); setError(""); try { await updateAdminSupportTicket(ticket.id, { status, admin_response: response }); onSaved(); } catch (reason) { setError(errorText(reason, "ذخیره پاسخ انجام نشد.")); } finally { setBusy(false); } }
  return <Modal title={ticket.subject} onClose={onClose} footer={<><button type="button" onClick={onClose}>انصراف</button><button type="button" disabled={busy || (status === "answered" && !response.trim())} onClick={save}>{busy ? "در حال ذخیره…" : "ذخیره پاسخ"}</button></>}><dl><div><dt>مشتری</dt><dd>{ticket.customer.name}</dd></div><div><dt>رزرو</dt><dd dir="ltr">{ticket.booking_code ?? "—"}</dd></div></dl><h3>پیام مشتری</h3><p>{ticket.message}</p><div className="admin-edit-grid"><Field label="وضعیت"><select value={status} onChange={(event) => setStatus(event.target.value as AdminSupportTicket["status"])}>{Object.entries(supportLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field><Field label="پاسخ تیم" wide><textarea rows={6} value={response} onChange={(event) => setResponse(event.target.value)} /></Field></div>{error && <p className="admin-inline-message">{error}</p>}</Modal>;
}

function CancellationOperations() {
  const [items, setItems] = useState<AdminCancellation[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [selected, setSelected] = useState<AdminCancellation | null>(null);
  const load = () => { setLoading(true); setError(""); fetchAdminCancellations().then((value) => setItems(value ?? [])).catch((reason) => setError(errorText(reason, "دریافت درخواست‌های لغو ناموفق بود."))).finally(() => setLoading(false)); };
  useEffect(load, []);
  return <><section className="admin-panel"><div className="panel-head"><div><h2>لغو و بازگشت وجه</h2><p>{items.filter((item) => item.status === "requested").length.toLocaleString("fa-IR")} درخواست در انتظار</p></div></div>{error ? <ErrorState message={error} onRetry={load} /> : loading ? <LoadingState message="در حال دریافت درخواست‌ها…" /> : items.length ? <div className="booking-table-wrap"><table className="admin-table"><thead><tr><th>رزرو</th><th>مشتری</th><th>دلیل</th><th>برآورد بازگشت</th><th>وضعیت</th><th>تاریخ درخواست</th><th /></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td dir="ltr">{item.booking_code}<small>{item.villa_title}</small></td><td>{item.customer.name}<small dir="ltr">{item.customer.phone}</small></td><td>{item.reason}</td><td>{item.refund_percentage.toLocaleString("fa-IR")}٪ · {money(item.estimated_refund_amount)} تومان</td><td>{cancellationLabels[item.status]}</td><td>{shamsiDateTime(item.requested_at)}</td><td><button type="button" onClick={() => setSelected(item)}>بررسی</button></td></tr>)}</tbody></table></div> : <EmptyState message="درخواست لغوی ثبت نشده است." />}</section>{selected && <CancellationModal item={selected} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); load(); }} />}</>;
}

function CancellationModal({ item, onClose, onSaved }: { item: AdminCancellation; onClose: () => void; onSaved: () => void }) {
  const confirmAdmin = useAdminConfirm();
  const [note, setNote] = useState(item.admin_note); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function act(action: "approve" | "reject" | "refunded") { const copy = action === "approve" ? "لغو رزرو تأیید شود؟" : action === "reject" ? "درخواست لغو رد شود؟" : "تأیید می‌کنید وجه واقعاً بازگردانده شده است؟"; if (!(await confirmAdmin({ title: action === "approve" ? "تأیید لغو رزرو" : action === "reject" ? "رد درخواست لغو" : "ثبت بازگشت وجه", message: copy, confirmLabel: action === "refunded" ? "ثبت بازگشت وجه" : "تأیید عملیات", tone: "danger" }))) return; setBusy(true); setError(""); try { await actOnAdminCancellation(item.id, action, note); onSaved(); } catch (reason) { setError(errorText(reason, "ثبت عملیات لغو انجام نشد.")); } finally { setBusy(false); } }
  return <Modal title="بررسی درخواست لغو" onClose={onClose} footer={<><button type="button" onClick={onClose}>بستن</button>{item.status === "requested" && <><button type="button" disabled={busy} onClick={() => act("reject")}>رد درخواست</button><button type="button" disabled={busy} onClick={() => act("approve")}>تأیید لغو</button></>}{item.status === "approved" && <button type="button" disabled={busy} onClick={() => act("refunded")}>ثبت بازگشت وجه</button>}</>}><dl><div><dt>رزرو</dt><dd dir="ltr">{item.booking_code}</dd></div><div><dt>اقامتگاه</dt><dd>{item.villa_title}</dd></div><div><dt>مشتری</dt><dd>{item.customer.name}</dd></div><div><dt>برآورد بازگشت</dt><dd>{money(item.estimated_refund_amount)} تومان</dd></div></dl><h3>دلیل مشتری</h3><p>{item.reason}</p><Field label="یادداشت داخلی" wide><textarea rows={5} value={note} onChange={(event) => setNote(event.target.value)} /></Field>{error && <p className="admin-inline-message">{error}</p>}</Modal>;
}

function AuditOperations() {
  const [items, setItems] = useState<AdminAuditLog[]>([]); const [count, setCount] = useState(0); const [page, setPage] = useState(1); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const load = () => { setLoading(true); setError(""); fetchAdminAuditLogs(page).then((value) => { setItems(value?.results ?? []); setCount(value?.count ?? 0); }).catch((reason) => setError(errorText(reason, "دریافت گزارش فعالیت‌ها ناموفق بود."))).finally(() => setLoading(false)); };
  useEffect(load, [page]);
  return <section className="admin-panel"><div className="panel-head"><div><h2>ردیابی تغییرات حساس</h2><p>{count.toLocaleString("fa-IR")} رویداد ثبت‌شده</p></div></div>{error ? <ErrorState message={error} onRetry={load} /> : loading ? <LoadingState message="در حال دریافت فعالیت‌ها…" /> : items.length ? <><div className="booking-table-wrap"><table className="admin-table"><thead><tr><th>زمان</th><th>مدیر</th><th>عملیات</th><th>هدف</th><th>جزئیات</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td>{shamsiDateTime(item.created_at)}</td><td>{item.actor.name}<small>{item.actor.role}</small></td><td>{auditLabels[item.action] ?? item.action}</td><td>{item.target_type} · {item.target_id}</td><td><code dir="ltr">{Object.keys(item.metadata).length ? JSON.stringify(item.metadata) : "—"}</code></td></tr>)}</tbody></table></div><div className="admin-pagination"><button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>صفحه قبل</button><span>صفحه {page.toLocaleString("fa-IR")}</span><button type="button" disabled={page * 25 >= count} onClick={() => setPage((value) => value + 1)}>صفحه بعد</button></div></> : <EmptyState message="هنوز فعالیت حساسی ثبت نشده است." />}</section>;
}

function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: React.ReactNode }) { return <label className={wide ? "wide-field" : ""}><span>{label}</span>{children}</label>; }
function Status({ value, state }: { value: string; state: string }) { return <span className={`admin-status ${state}`}><i />{value}</span>; }
function LoadingState({ message }: { message: string }) { return <div className="admin-state"><span className="status-pulse" /><p>{message}</p></div>; }
function EmptyState({ message }: { message: string }) { return <div className="admin-state"><p>{message}</p></div>; }
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) { return <div className="admin-state is-error"><p>{message}</p><button type="button" onClick={onRetry}>تلاش دوباره</button></div>; }
function Modal({ title, onClose, footer, children }: { title: string; onClose: () => void; footer?: React.ReactNode; children: React.ReactNode }) {
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      trapDialogFocus(event, panelRef.current);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => { window.removeEventListener("keydown", onKeyDown); document.body.style.overflow = previousOverflow; previous?.focus(); };
  }, [onClose]);
  return <div className="admin-modal-backdrop" onMouseDown={onClose}><aside ref={panelRef} className="admin-detail-modal admin-form-modal" role="dialog" aria-modal="true" aria-labelledby="admin-modal-title" onMouseDown={(event) => event.stopPropagation()}><header><div><p className="eyebrow">مرکز عملیات</p><h2 id="admin-modal-title">{title}</h2></div><button ref={closeRef} type="button" onClick={onClose} aria-label="بستن">×</button></header><section>{children}</section>{footer && <footer>{footer}</footer>}</aside></div>;
}
