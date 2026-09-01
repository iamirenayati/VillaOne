import type { VillaListing } from "../types/villa";

const configuredApiUrl = process.env.NEXT_PUBLIC_VILLAONE_API_URL?.replace(/\/$/, "");
const internalApiUrl = process.env.VILLAONE_INTERNAL_API_URL?.replace(/\/$/, "");

function apiBase(): string | null {
  if (configuredApiUrl) return configuredApiUrl;
  if (internalApiUrl) return internalApiUrl;
  if (typeof window === "undefined" && process.env.NODE_ENV !== "production") return "http://127.0.0.1:8000/api/v1";
  if (typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname)) {
    return "http://127.0.0.1:8000/api/v1";
  }
  return null;
}

export type VillaOneApiErrorDetails = {
  code?: string;
  field_errors?: Record<string, unknown>;
  request_id?: string;
  retryable?: boolean;
};

function normalizeFieldErrors(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([field, errors]) => [
    field,
    Array.isArray(errors) ? errors.map(String) : [String(errors)],
  ]));
}

export class VillaOneApiError extends Error {
  readonly code: string;
  readonly fieldErrors: Record<string, string[]>;
  readonly requestId: string;
  readonly retryable: boolean;

  constructor(message: string, public status = 0, details: VillaOneApiErrorDetails = {}) {
    super(message);
    this.name = "VillaOneApiError";
    this.code = details.code ?? "unknown_error";
    this.fieldErrors = normalizeFieldErrors(details.field_errors);
    this.requestId = details.request_id ?? "";
    this.retryable = details.retryable ?? status >= 500;
  }
}

function accessToken() {
  return typeof window === "undefined" ? null : window.localStorage.getItem("villaone-access-token");
}

function clearExpiredSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem("villaone-access-token");
  window.localStorage.removeItem("villaone-refresh-token");
  window.localStorage.removeItem("villaone-user");
  window.dispatchEvent(new CustomEvent("villaone-session-expired"));
}

async function refreshAccessToken() {
  const base = apiBase();
  const refresh = typeof window === "undefined" ? null : window.localStorage.getItem("villaone-refresh-token");
  if (!base || !refresh) return null;
  const response = await fetch(`${base}/auth/token/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });
  if (!response.ok) return null;
  const data = await response.json() as { access: string; refresh?: string };
  window.localStorage.setItem("villaone-access-token", data.access);
  if (data.refresh) window.localStorage.setItem("villaone-refresh-token", data.refresh);
  return data.access;
}

async function apiFetch<T>(path: string, init: RequestInit = {}, authenticated = false, retry = true): Promise<T> {
  const base = apiBase();
  if (!base) throw new VillaOneApiError("API_NOT_CONFIGURED");
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData) && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (authenticated && accessToken()) headers.set("Authorization", `Bearer ${accessToken()}`);
  const response = await fetch(`${base}${path}`, { ...init, headers });
  if (response.status === 401 && authenticated && retry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return apiFetch<T>(path, init, authenticated, false);
    clearExpiredSession();
    throw new VillaOneApiError("نشست شما منقضی شده است؛ لطفاً دوباره وارد شوید.", 401, { code: "token_expired", retryable: false, request_id: response.headers.get("X-Request-ID") ?? "" });
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as Record<string, unknown> & { detail?: string | string[]; non_field_errors?: string[]; code?: string; field_errors?: Record<string, unknown>; request_id?: string; retryable?: boolean };
    const detail = Array.isArray(payload.detail) ? payload.detail.join(" ") : payload.detail;
    const fieldErrors = normalizeFieldErrors(payload.field_errors);
    const fieldMessage = Object.values(fieldErrors).flat().join(" ") || Object.entries(payload)
      .filter(([key]) => !["detail", "non_field_errors", "code", "field_errors", "request_id", "retryable"].includes(key))
      .flatMap(([, value]) => Array.isArray(value) ? value.map(String) : typeof value === "string" ? [value] : [])
      .join(" ");
    throw new VillaOneApiError(
      detail || payload.non_field_errors?.join(" ") || fieldMessage || "ارتباط با سرور ناموفق بود.",
      response.status,
      {
        code: payload.code,
        field_errors: payload.field_errors,
        request_id: payload.request_id ?? response.headers.get("X-Request-ID") ?? "",
        retryable: payload.retryable,
      },
    );
  }
  return response.json() as Promise<T>;
}

type ApiVilla = {
  id: number;
  slug: string;
  title: string;
  city: { id: number; name: string; region: string };
  setting_tags: string[];
  bedrooms: number;
  beds?: number;
  bathrooms?: number;
  capacity: number;
  price_weekday: string;
  price_weekend: string;
  price_holiday: string;
  deposit_percentage: number;
  is_instant_bookable: boolean;
  featured: boolean;
  cover_image: string | null;
  description?: string;
  images?: { url: string }[];
  amenities?: { name: string }[];
  rating_average?: string | null;
  reviews_count?: number;
};

function settingLabel(tags: string[]) {
  const labels: Record<string, string> = { forest: "در آغوش جنگل", mountain: "چشم‌انداز کوهستان", beachfront: "نزدیک ساحل", countryside: "دشت و باغ" };
  return labels[tags[0]] ?? "طبیعت مازندران";
}

function formatToman(value: string | number) {
  return Number(value).toLocaleString("fa-IR");
}

function mapVilla(item: ApiVilla): VillaListing {
  const image = item.cover_image || item.images?.[0]?.url || "";
  return {
    slug: item.slug,
    title: item.title,
    city: item.city.name,
    region: `${item.city.name}، ${item.city.region}`,
    setting: settingLabel(item.setting_tags),
    description: item.description?.trim() || "",
    price: Number(item.price_weekday),
    priceLabel: formatToman(item.price_weekday),
    depositPercentage: item.deposit_percentage,
    guests: item.capacity,
    rooms: item.bedrooms,
    beds: item.beds ?? item.bedrooms,
    baths: item.bathrooms ?? 1,
    rating: item.reviews_count && item.rating_average
      ? Number(item.rating_average).toLocaleString("fa-IR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
      : "جدید",
    reviews: item.reviews_count ?? 0,
    badge: item.featured ? "منتخب ویلاوان" : item.is_instant_bookable ? "رزرو آنی" : "تأیید میزبان",
    instant: item.is_instant_bookable,
    pool: item.amenities?.some((amenity) => amenity.name.includes("استخر")) ?? false,
    image,
    gallery: item.images?.map((entry) => entry.url) ?? [],
    tags: item.amenities?.map((amenity) => amenity.name) ?? [],
  };
}

export async function fetchVillas(filters: { city?: string; checkin?: string; checkout?: string; guests?: string } = {}): Promise<VillaListing[] | null> {
  if (!apiBase()) return null;
  const query = new URLSearchParams();
  if (filters.city) query.set("city", filters.city);
  if (filters.checkin) query.set("checkin", filters.checkin);
  if (filters.checkout) query.set("checkout", filters.checkout);
  if (filters.guests) query.set("guests", filters.guests);
  const suffix = query.size ? `?${query.toString()}` : "";
  const data = await apiFetch<ApiVilla[]>(`/villas/${suffix}`);
  return data.map((item) => mapVilla(item));
}

export type MapVilla = {
  slug: string;
  title: string;
  city: City;
  setting_tags: string[];
  capacity: number;
  price_weekday: string;
  featured: boolean;
  cover_image: string | null;
  map_latitude: string;
  map_longitude: string;
  map_radius_meters: number;
};

export async function fetchMapVillas() {
  if (!apiBase()) return null;
  return apiFetch<MapVilla[]>("/villas/map/");
}

export type BusinessSettings = {
  brand_name: string; support_phone: string; support_whatsapp: string; operating_hours: string;
  footer_description: string; terms_text: string; privacy_text: string; cancellation_text: string;
  launch_ready: boolean; updated_at: string;
};

export type City = { id: number; name: string; region: string };

export async function fetchBusinessSettings() {
  return apiFetch<BusinessSettings>("/marketplace/site/");
}

export async function fetchCities() {
  return apiFetch<City[]>("/villas/cities/");
}

export async function fetchVilla(slug: string): Promise<VillaListing | null> {
  if (!apiBase()) return null;
  const data = await apiFetch<ApiVilla>(`/villas/${slug}/`);
  return mapVilla(data);
}

export async function fetchFavoriteVillas() {
  if (!apiBase() || !accessToken()) return null;
  const data = await apiFetch<ApiVilla[]>("/villas/favorites/", {}, true);
  return data.map((item) => mapVilla(item));
}

export async function toggleVillaFavorite(slug: string) {
  if (!apiBase() || !accessToken()) return null;
  return apiFetch<{ slug: string; saved: boolean }>(`/villas/${encodeURIComponent(slug)}/favorite/`, {
    method: "POST",
    body: "{}",
  }, true);
}

export type ApiAvailabilityDay = {
  date: string;
  status: "open" | "blocked" | "booked";
  price: string;
};

export async function fetchVillaAvailability(slug: string, start: string, end: string) {
  if (!apiBase()) return null;
  const query = new URLSearchParams({ start, end });
  return apiFetch<ApiAvailabilityDay[]>(`/villas/${slug}/availability/?${query.toString()}`);
}

export async function updateVillaAvailability(slug: string, day: string, status: ApiAvailabilityDay["status"], note = "") {
  if (!apiBase() || !accessToken()) throw new VillaOneApiError("برای ویرایش تقویم باید وارد حساب مدیر شوید.");
  return apiFetch<ApiAvailabilityDay>(`/villas/admin/${encodeURIComponent(slug)}/availability/${encodeURIComponent(day)}/`, {
    method: "PATCH",
    body: JSON.stringify({ status, note }),
  }, true);
}

export async function bulkUpdateVillaAvailability(slug: string, days: string[], status: ApiAvailabilityDay["status"], note = "") {
  if (!apiBase() || !accessToken()) throw new VillaOneApiError("برای ویرایش تقویم باید وارد حساب مدیر شوید.");
  return apiFetch<{ updated: number; status: string }>(`/villas/admin/${encodeURIComponent(slug)}/availability-bulk/`, { method: "POST", body: JSON.stringify({ days, status, note }) }, true);
}

export async function updateVillaPriceOverride(slug: string, day: string, price: number) {
  if (!apiBase() || !accessToken()) throw new VillaOneApiError("برای ویرایش قیمت باید وارد حساب مدیر شوید.");
  return apiFetch<{ date: string; price: string }>(`/villas/admin/${encodeURIComponent(slug)}/prices/${encodeURIComponent(day)}/`, { method: "PATCH", body: JSON.stringify({ price }) }, true);
}

export type VillaAdminUpdate = {
  title: string; description: string; bedrooms: number; beds: number; bathrooms: number; capacity: number;
  price_weekday: number; price_weekend: number; price_holiday: number; deposit_percentage: number;
  is_instant_bookable: boolean; requires_id_verification: boolean; featured: boolean; status: string;
  latitude: number | null; longitude: number | null; map_radius_meters: number;
};

export type AdminVilla = VillaAdminUpdate & { slug: string; city: City; cover_image: string | null };

export async function fetchAdminVillas() {
  if (!apiBase() || !accessToken()) return null;
  return apiFetch<AdminVilla[]>("/villas/admin/", {}, true);
}

export async function updateVillaAdmin(slug: string, input: Partial<VillaAdminUpdate>) {
  if (!apiBase() || !accessToken()) throw new VillaOneApiError("برای ویرایش ویلا باید وارد حساب مدیر شوید.");
  return apiFetch<AdminVilla>(`/villas/admin/${encodeURIComponent(slug)}/`, { method: "PATCH", body: JSON.stringify(input) }, true);
}

export function djangoAdminUrl(path = "") {
  const base = apiBase();
  if (!base) return null;
  return `${base.replace(/\/api\/v1$/, "")}/admin/${path.replace(/^\//, "")}`;
}

export async function requestOtp(phone: string) {
  if (!apiBase()) throw new VillaOneApiError("سامانه ورود در دسترس نیست.");
  const data = await apiFetch<{ message: string; expires_in: number; debug_code?: string }>("/auth/otp/request/", {
    method: "POST",
    body: JSON.stringify({ phone }),
  });
  return { mode: "api" as const, debugCode: data.debug_code };
}

export async function verifyOtp(phone: string, code: string) {
  if (!apiBase()) {
    throw new VillaOneApiError("سامانه ورود در دسترس نیست.");
  }
  const data = await apiFetch<{ access: string; refresh: string; user: unknown }>("/auth/otp/verify/", {
    method: "POST",
    body: JSON.stringify({ phone, code }),
  });
  window.localStorage.setItem("villaone-access-token", data.access);
  window.localStorage.setItem("villaone-refresh-token", data.refresh);
  window.localStorage.setItem("villaone-user", JSON.stringify(data.user));
  return { mode: "api" as const };
}

export type ApiUser = {
  id: number;
  phone: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  is_staff: boolean;
  is_phone_verified: boolean;
  booking_sms_enabled: boolean;
  marketing_sms_enabled: boolean;
  email_notifications_enabled: boolean;
};

export function hasAuthenticatedSession() {
  return Boolean(accessToken());
}

export async function fetchCurrentUser() {
  if (!apiBase() || !accessToken()) return null;
  return apiFetch<ApiUser>("/auth/me/", {}, true);
}

export async function updateCurrentUser(input: { first_name: string; last_name: string; email: string; booking_sms_enabled: boolean; marketing_sms_enabled: boolean; email_notifications_enabled: boolean }) {
  if (!apiBase() || !accessToken()) return null;
  const user = await apiFetch<ApiUser>("/auth/me/", {
    method: "PATCH",
    body: JSON.stringify(input),
  }, true);
  window.localStorage.setItem("villaone-user", JSON.stringify(user));
  return user;
}

export function signOut() {
  if (typeof window === "undefined") return;
  const refresh = window.localStorage.getItem("villaone-refresh-token");
  const base = apiBase();
  if (base && refresh) {
    void fetch(`${base}/auth/logout/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
      keepalive: true,
    });
  }
  window.localStorage.removeItem("villaone-access-token");
  window.localStorage.removeItem("villaone-refresh-token");
  window.localStorage.removeItem("villaone-user");
}

export type BookingServiceItem = {
  id?: number;
  slug: string;
  title: string;
  unit_price: string;
  quantity: number;
  total_price: string;
  status: "requested" | "confirmed" | "unavailable" | "completed" | "cancelled";
  pricing_model: ServiceOffer["pricing_model"];
  unit_label: string;
  service_date: string | null;
  time_slot: ServiceTimeSlot;
  customer_note: string;
};

export type ServiceSelection = {
  slug: string;
  quantity?: number;
  service_date?: string;
  time_slot?: Exclude<ServiceTimeSlot, "">;
  note?: string;
};

export type ServiceTimeSlot = "" | "breakfast" | "lunch" | "dinner" | "morning" | "afternoon" | "evening" | "flexible";

export type ApiBooking = {
  code: string;
  villa: ApiVilla;
  checkin: string;
  checkout: string;
  guests_count: number;
  stay_total: string;
  services_total: string;
  total_price: string;
  service_items: BookingServiceItem[];
  payment_plan: "deposit" | "full";
  amount_due_now: string;
  deposit_paid_online: string;
  remaining_amount: string;
  remaining_payment_method: "cash" | "card_on_arrival" | "online_later";
  status: "pending_owner" | "confirmed" | "cancelled" | "completed" | "expired";
  guest_note: string;
  expires_at: string | null;
  cancellation_status: "requested" | "approved" | "rejected" | "refunded" | null;
  cancellation_quote: { days_before_checkin: number; refund_percentage: number; estimated_refund_amount: string };
  refund_amount: string;
  payments: ApiPayment[];
  review: VillaReview | null;
};

export type VillaReview = {
  id: number;
  rating: number;
  title: string;
  comment: string;
  status?: "pending" | "approved" | "rejected";
  guest_name: string;
  created_at: string;
};

export async function fetchVillaReviews(slug: string) {
  if (!apiBase()) return null;
  return apiFetch<VillaReview[]>(`/villas/${encodeURIComponent(slug)}/reviews/`);
}

export async function createBookingReview(code: string, input: { rating: number; title: string; comment: string }) {
  if (!apiBase() || !accessToken()) return null;
  return apiFetch<VillaReview>(`/bookings/mine/${encodeURIComponent(code)}/review/`, {
    method: "POST",
    body: JSON.stringify(input),
  }, true);
}

export async function createApiBooking(input: { villaSlug: string; checkin: string; checkout: string; guests: number; paymentType: "deposit" | "full"; guestNote?: string; serviceSlugs?: string[]; serviceItems?: ServiceSelection[]; clientRequestId?: string }) {
  if (!apiBase()) throw new VillaOneApiError("سامانه رزرو در دسترس نیست.");
  return apiFetch<ApiBooking>("/bookings/", {
    method: "POST",
    body: JSON.stringify({
      villa_slug: input.villaSlug,
      checkin: input.checkin,
      checkout: input.checkout,
      guests_count: input.guests,
      payment_type: input.paymentType,
      guest_note: input.guestNote ?? "",
      client_request_id: input.clientRequestId,
      ...(input.serviceItems ? { service_items: input.serviceItems } : { service_slugs: input.serviceSlugs ?? [] }),
    }),
  }, true);
}

export type ApiPayment = {
  id: number;
  gateway: "card_to_card" | "manual" | "zarinpal" | "zibal" | "idpay";
  amount: string;
  status: "pending" | "paid" | "partially_paid" | "refunded" | "failed";
  authority: string;
  reference_id: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  review_note: string;
  attempt_number: number;
  created_at: string;
};

export type CardTransferInstructions = { amount: string; bank_name: string; cardholder_name: string; card_number: string; expires_at: string | null };

export async function fetchCardTransferInstructions(code: string) {
  if (!apiBase() || !accessToken()) throw new VillaOneApiError("برای پرداخت باید وارد حساب شوید.");
  return apiFetch<CardTransferInstructions>(`/bookings/mine/${encodeURIComponent(code)}/payment-instructions/`, {}, true);
}

export async function submitCardTransfer(code: string, input: { proofImage: File; referenceId?: string; clientRequestId?: string }) {
  if (!apiBase() || !accessToken()) throw new VillaOneApiError("برای ارسال رسید باید وارد حساب شوید.");
  const form = new FormData(); form.append("proof_image", input.proofImage); form.append("reference_id", input.referenceId ?? "");
  if (input.clientRequestId) form.append("client_request_id", input.clientRequestId);
  let response = await fetch(`${apiBase()}/bookings/mine/${encodeURIComponent(code)}/card-transfer/`, { method: "POST", headers: { Authorization: `Bearer ${accessToken()}` }, body: form });
  if (response.status === 401 && await refreshAccessToken()) {
    response = await fetch(`${apiBase()}/bookings/mine/${encodeURIComponent(code)}/card-transfer/`, { method: "POST", headers: { Authorization: `Bearer ${accessToken()}` }, body: form });
  }
  if (response.status === 401) clearExpiredSession();
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new VillaOneApiError(Array.isArray(payload.detail) ? payload.detail.join(" ") : payload.detail || "ارسال رسید انجام نشد.", response.status);
  return payload as ApiPayment;
}

export type AdminCardTransferPayment = {
  id: number; gateway: "card_to_card"; amount: string; status: "pending" | "paid" | "failed"; reference_id: string;
  submitted_at: string | null; reviewed_at: string | null; review_note: string; attempt_number: number; booking_code: string; booking_status: ApiBooking["status"];
  villa: { slug: string; title: string; city: string }; customer: { name: string; phone: string }; stay: { checkin: string; checkout: string; guests_count: number };
  financials: { total_price: string; amount_due_now: string; paid: string; remaining: string; payment_plan: "deposit" | "full" };
  services: { title: string; quantity: number; total_price: string }[]; hold_expires_at: string | null; reviewer: { name: string; role: string } | null; proof_available: boolean;
};
export type Paginated<T> = { count: number; next: string | null; previous: string | null; results: T[] };

export async function fetchAdminCardTransferPayments(input: { status?: "pending" | "paid" | "failed" | "all"; q?: string; page?: number } = {}) {
  if (!apiBase() || !accessToken()) return null;
  const params = new URLSearchParams({ status: input.status ?? "pending", page: String(input.page ?? 1) });
  if (input.q?.trim()) params.set("q", input.q.trim());
  return apiFetch<Paginated<AdminCardTransferPayment>>(`/bookings/admin/payments/?${params.toString()}`, {}, true);
}

export async function reviewAdminCardTransferPayment(paymentId: number, action: "approve" | "reject", reviewNote = "") {
  if (!apiBase() || !accessToken()) throw new VillaOneApiError("برای بررسی رسید باید وارد حساب مدیر شوید.");
  return apiFetch<ApiPayment>(`/bookings/admin/payments/${paymentId}/review/`, { method: "POST", body: JSON.stringify({ action, review_note: reviewNote }) }, true);
}

export async function fetchAdminCardTransferProof(paymentId: number) {
  const base = apiBase(); const token = accessToken();
  if (!base || !token) throw new VillaOneApiError("برای مشاهده رسید باید وارد حساب مدیر شوید.");
  const response = await fetch(`${base}/bookings/admin/payments/${paymentId}/proof/`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new VillaOneApiError("دریافت تصویر رسید ناموفق بود.", response.status);
  return URL.createObjectURL(await response.blob());
}

export async function fetchMyBookings() {
  if (!apiBase() || !accessToken()) return null;
  return apiFetch<ApiBooking[]>("/bookings/mine/", {}, true);
}

export async function fetchAdminBookings(status?: string) {
  if (!apiBase() || !accessToken()) return null;
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiFetch<ApiBooking[]>(`/bookings/admin/${query}`, {}, true);
}

export type AdminOperationsOverview = {
  pending_bookings: number; expiring_holds: number; unpaid_bookings: number; pending_transfer_receipts: number; pending_services: number; expiring_transfer_reviews: number; open_support_tickets: number;
  open_cancellations: number; unassigned_leads: number; overdue_follow_ups: number; blocked_days: number;
  paid_total: string; recent_bookings: ApiBooking[];
};

export async function fetchAdminOperationsOverview() {
  if (!apiBase() || !accessToken()) return null;
  return apiFetch<AdminOperationsOverview>("/bookings/admin/overview/", {}, true);
}

export type AdminSystemStatus = {
  status: "ok" | "degraded";
  scheduler_stale: boolean;
  tasks: Record<string, { status: "running" | "succeeded" | "failed"; last_started_at: string | null; last_succeeded_at: string | null; last_failed_at: string | null; duration_ms: number; processed_count: number; error_summary: string; details: Record<string, unknown> }>;
};

export async function fetchAdminSystemStatus() {
  if (!apiBase() || !accessToken()) return null;
  return apiFetch<AdminSystemStatus>("/bookings/admin/system-status/", {}, true);
}

export type CustomerNotification = {
  id: number; kind: string; title: string; message: string; booking_code: string | null;
  metadata: Record<string, unknown>; read_at: string | null; created_at: string;
};

export async function fetchCustomerNotifications() {
  if (!apiBase() || !accessToken()) return null;
  return apiFetch<CustomerNotification[]>("/bookings/notifications/", {}, true);
}

export async function markCustomerNotificationRead(id: number) {
  if (!apiBase() || !accessToken()) throw new VillaOneApiError("برای مشاهده اعلان باید وارد حساب شوید.");
  return apiFetch<CustomerNotification>(`/bookings/notifications/${id}/read/`, { method: "POST", body: "{}" }, true);
}

export async function recordAdminManualPayment(code: string, amount?: number) {
  if (!apiBase() || !accessToken()) throw new VillaOneApiError("برای ثبت پرداخت باید وارد حساب مدیر شوید.");
  return apiFetch<ApiPayment>(`/bookings/admin/${encodeURIComponent(code)}/manual-payment/`, { method: "POST", body: JSON.stringify(amount ? { amount } : {}) }, true);
}

export async function decideAdminBooking(code: string, action: "approve" | "reject") {
  if (!apiBase() || !accessToken()) throw new VillaOneApiError("برای مدیریت رزرو باید وارد حساب مدیر شوید.");
  return apiFetch<ApiBooking>(`/bookings/admin/${encodeURIComponent(code)}/decision/`, {
    method: "POST",
    body: JSON.stringify({ action }),
  }, true);
}

export async function reconcileAdminPayment(paymentId: number) {
  if (!apiBase() || !accessToken()) throw new VillaOneApiError("برای ثبت وصول باید وارد حساب مدیر شوید.");
  return apiFetch<ApiPayment>(`/bookings/admin/payments/${paymentId}/reconcile/`, { method: "POST", body: "{}" }, true);
}

export type AdminSupportTicket = {
  id: number; customer: { name: string; phone: string }; booking_code: string | null; category: SupportTicket["category"];
  subject: string; message: string; status: SupportTicket["status"]; admin_response: string; created_at: string; updated_at: string;
};
export async function fetchAdminSupportTickets(status?: AdminSupportTicket["status"]) {
  if (!apiBase() || !accessToken()) return null;
  return apiFetch<AdminSupportTicket[]>(`/bookings/admin/support/${status ? `?status=${encodeURIComponent(status)}` : ""}`, {}, true);
}
export async function updateAdminSupportTicket(id: number, input: { status: AdminSupportTicket["status"]; admin_response: string }) {
  if (!apiBase() || !accessToken()) throw new VillaOneApiError("برای مدیریت پشتیبانی باید وارد حساب مدیر شوید.");
  return apiFetch<AdminSupportTicket>(`/bookings/admin/support/${id}/`, { method: "PATCH", body: JSON.stringify(input) }, true);
}

export type AdminCancellation = {
  id: number; booking: number; booking_code: string; villa_title: string; customer: { name: string; phone: string }; reason: string; status: "requested" | "approved" | "rejected" | "refunded";
  refund_percentage: number; estimated_refund_amount: string; admin_note: string; requested_at: string; resolved_at: string | null;
};
export async function fetchAdminCancellations(status?: AdminCancellation["status"]) {
  if (!apiBase() || !accessToken()) return null;
  return apiFetch<AdminCancellation[]>(`/bookings/admin/cancellations/${status ? `?status=${encodeURIComponent(status)}` : ""}`, {}, true);
}
export async function actOnAdminCancellation(id: number, action: "approve" | "reject" | "refunded", adminNote = "") {
  if (!apiBase() || !accessToken()) throw new VillaOneApiError("برای مدیریت لغو باید وارد حساب مدیر شوید.");
  return apiFetch<AdminCancellation>(`/bookings/admin/cancellations/${id}/`, { method: "POST", body: JSON.stringify({ action, admin_note: adminNote }) }, true);
}

export type AdminAuditLog = { id: number; actor: { name: string; phone: string; role: string }; action: string; target_type: string; target_id: string; metadata: Record<string, unknown>; created_at: string };
export async function fetchAdminAuditLogs(page = 1) {
  if (!apiBase() || !accessToken()) return null;
  return apiFetch<{ count: number; next: string | null; previous: string | null; results: AdminAuditLog[] }>(`/bookings/admin/audit/?page=${page}`, {}, true);
}

export type AdminInquiry = { id: number; kind: "real_estate" | "contractor" | "service"; name: string; phone: string; message: string; status: "new" | "contacted" | "introduced" | "closed"; admin_note: string; follow_up_at: string | null; target: string; assigned_contractor: { slug: string; name: string } | null; created_at: string };
export type AdminContractor = Contractor & { status: "draft" | "published" | "archived"; inquiry_count: number };
export async function fetchAdminContractors(query = "") {
  if (!apiBase() || !accessToken()) return null;
  const suffix = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
  return apiFetch<AdminContractor[]>(`/marketplace/admin/contractors/${suffix}`, {}, true);
}
export async function updateAdminContractor(slug: string, input: Partial<Pick<AdminContractor, "name" | "specialty" | "city" | "years_experience" | "description" | "services" | "cover_image" | "verified" | "featured" | "status">>) {
  if (!apiBase() || !accessToken()) throw new VillaOneApiError("برای مدیریت پیمانکاران باید وارد حساب مدیر شوید.");
  return apiFetch<AdminContractor>(`/marketplace/admin/contractors/${encodeURIComponent(slug)}/`, { method: "PATCH", body: JSON.stringify(input) }, true);
}
export async function fetchAdminInquiries(kind?: AdminInquiry["kind"]) {
  if (!apiBase() || !accessToken()) return null;
  const suffix = kind ? `?kind=${encodeURIComponent(kind)}` : "";
  return apiFetch<AdminInquiry[]>(`/marketplace/admin/inquiries/${suffix}`, {}, true);
}
export async function updateAdminInquiry(id: number, input: { status?: AdminInquiry["status"]; admin_note?: string; follow_up_at?: string | null; assigned_contractor_slug?: string | null }) {
  if (!apiBase() || !accessToken()) throw new VillaOneApiError("برای مدیریت پیگیری‌ها باید وارد حساب مدیر شوید.");
  return apiFetch<AdminInquiry>(`/marketplace/admin/inquiries/${id}/`, { method: "PATCH", body: JSON.stringify(input) }, true);
}

export async function fetchBookingDetail(code: string) {
  if (!apiBase() || !accessToken()) return null;
  return apiFetch<ApiBooking>(`/bookings/mine/${encodeURIComponent(code)}/`, {}, true);
}

export type BookingQuote = {
  nights: number;
  stay_total: string;
  services_total: string;
  services: Array<Pick<BookingServiceItem, "slug" | "title" | "unit_price" | "quantity" | "total_price" | "pricing_model" | "unit_label" | "service_date" | "time_slot">>;
  service_fee: string;
  discount: string;
  total_price: string;
  amount_due_now: string;
  remaining_amount: string;
  deposit_percentage: number;
};

export async function fetchBookingQuote(input: { villaSlug: string; checkin: string; checkout: string; guests: number; paymentType: "deposit" | "full"; serviceSlugs?: string[]; serviceItems?: ServiceSelection[] }) {
  if (!apiBase()) return null;
  return apiFetch<BookingQuote>("/bookings/quote/", {
    method: "POST",
    body: JSON.stringify({
      villa_slug: input.villaSlug,
      checkin: input.checkin,
      checkout: input.checkout,
      guests_count: input.guests,
      payment_type: input.paymentType,
      ...(input.serviceItems ? { service_items: input.serviceItems } : { service_slugs: input.serviceSlugs ?? [] }),
    }),
  });
}

export async function requestBookingCancellation(code: string, reason: string) {
  if (!apiBase() || !accessToken()) return null;
  return apiFetch<{ status: "requested"; refund_percentage: number; estimated_refund_amount: string }>(`/bookings/mine/${encodeURIComponent(code)}/cancellation/`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  }, true);
}

export type SupportTicket = {
  id: number;
  booking: string | null;
  category: "booking" | "payment" | "cancellation" | "stay" | "other";
  subject: string;
  message: string;
  status: "open" | "in_progress" | "answered" | "closed";
  admin_response: string;
  created_at: string;
  updated_at: string;
};

export async function fetchSupportTickets() {
  if (!apiBase() || !accessToken()) return null;
  return apiFetch<SupportTicket[]>("/bookings/support/", {}, true);
}

export async function createSupportTicket(input: { bookingCode?: string; category: SupportTicket["category"]; subject: string; message: string }) {
  if (!apiBase() || !accessToken()) return null;
  return apiFetch<SupportTicket>("/bookings/support/", {
    method: "POST",
    body: JSON.stringify({ booking_code: input.bookingCode ?? "", category: input.category, subject: input.subject, message: input.message }),
  }, true);
}

export function hasConfiguredApi() {
  return apiBase() !== null;
}

export type RealEstateListing = {
  id: number; slug: string; title: string; city: string; neighborhood: string;
  property_type: "villa" | "land" | "apartment"; price: string; area_m2: number;
  bedrooms: number; description: string; features: string[]; cover_image: string; is_featured: boolean;
};

export type Contractor = {
  id: number; slug: string; name: string; specialty: string; city: string;
  years_experience: number; description: string; services: string[]; catalog: ContractorCatalogItem[]; cover_image: string; verified: boolean; featured: boolean;
};
  export type ContractorCatalogItem = {
    type: "project" | "product"; title: string; subtitle: string; description: string;
    area?: string; price_from: number; price_to: number; timeline: string; features: string[];
    image?: string; price_note?: string; scope?: string; ideal_for?: string;
    deliverables?: string[]; materials?: string[];
  };

export type JournalArticle = {
  id: number; slug: string; title: string; excerpt: string; body: string;
  body_html?: string | null; category: string; category_code?: string; author_name: string; cover_image: string; cover_alt?: string;
  published_at: string | null; updated_at?: string; reading_time_minutes?: number;
  inline_images?: { key: string; url: string; alt_text: string; caption: string; sort_order: number; width: number; height: number }[];
  cta?: { label: string; url: string } | null;
  related_articles?: { id: number; slug: string; title: string; excerpt: string; category: string; cover_image: string; published_at: string | null }[];
};
export type ServiceOffer = {
  id: number;
  slug: string;
  title: string;
  category: string;
  short_description: string;
  description: string;
  price_note: string;
  base_price: string;
  cover_image: string;
  gallery: { id: number; image: string; alt_text: string; sort_order: number }[];
  features: string[];
  inclusions: string[];
  exclusions: string[];
  preparation_notes: string;
  cancellation_text: string;
  fulfillment_mode: "bookable" | "inquiry_only" | "both";
  pricing_model: "fixed" | "per_guest" | "per_night" | "per_unit";
  unit_label: string;
  minimum_quantity: number;
  maximum_quantity: number;
  minimum_lead_hours: number;
  default_daily_capacity: number;
  schedule_type: "none" | "stay_date" | "checkin" | "checkout";
  featured: boolean;
  sort_order: number;
};

export async function fetchRealEstateListings(city?: string) {
  if (!apiBase()) return null;
  const suffix = city ? `?city=${encodeURIComponent(city)}` : "";
  return apiFetch<RealEstateListing[]>(`/marketplace/real-estate/${suffix}`);
}

export async function fetchRealEstateListing(slug: string) {
  if (!apiBase()) return null;
  return apiFetch<RealEstateListing>(`/marketplace/real-estate/${encodeURIComponent(slug)}/`);
}

export async function fetchContractors() {
  if (!apiBase()) return null;
  return apiFetch<Contractor[]>("/marketplace/contractors/");
}

export async function fetchContractor(slug: string) {
  if (!apiBase()) return null;
  return apiFetch<Contractor>(`/marketplace/contractors/${encodeURIComponent(slug)}/`);
}

export async function fetchArticles(category?: string) {
  if (!apiBase()) return null;
  const suffix = category ? `?category=${encodeURIComponent(category)}` : "";
  return apiFetch<JournalArticle[]>(`/marketplace/articles/${suffix}`, { cache: "no-store" });
}

export async function fetchArticle(slug: string) {
  if (!apiBase()) return null;
  return apiFetch<JournalArticle>(`/marketplace/articles/${encodeURIComponent(slug)}/`, { cache: "no-store" });
}

export function formatPersianDate(value: string | null | undefined) {
  if (!value) return "";
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value));
}
export async function fetchServices() {
  if (!apiBase()) return null;
  return apiFetch<ServiceOffer[]>("/marketplace/services/");
}

export async function fetchService(slug: string) {
  if (!apiBase()) return null;
  return apiFetch<ServiceOffer>(`/marketplace/services/${encodeURIComponent(slug)}/`);
}

export async function fetchEligibleServices(input: { villaSlug: string; checkin: string; checkout: string }) {
  if (!apiBase()) return null;
  const query = new URLSearchParams({ villa: input.villaSlug, checkin: input.checkin, checkout: input.checkout });
  return apiFetch<ServiceOffer[]>(`/marketplace/services/eligible/?${query.toString()}`);
}

export type AdminServiceOffer = ServiceOffer & {
  status: "draft" | "published" | "archived";
  eligible_villa_slugs: string[];
  reservation_count: number;
};

export type ServiceAvailabilityDay = {
  date: string;
  status: "available" | "blocked" | "closed";
  capacity: number;
  capacity_override: number | null;
  price_override: string | null;
  reserved: number;
  admin_note: string;
};

export type AdminBookingService = BookingServiceItem & {
  id: number;
  booking_code: string;
  booking_status: ApiBooking["status"];
  villa: { slug: string; title: string; city: string };
  customer: { name: string; phone: string };
  stay: { checkin: string; checkout: string; guests_count: number };
  service_slug: string;
  admin_note: string;
  created_at: string;
};

export async function fetchAdminServices(query = "") {
  if (!apiBase() || !accessToken()) return null;
  const suffix = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
  return apiFetch<AdminServiceOffer[]>(`/marketplace/admin/services/${suffix}`, {}, true);
}

export async function createAdminService(input: Partial<AdminServiceOffer>) {
  if (!apiBase() || !accessToken()) throw new VillaOneApiError("برای ایجاد خدمت باید وارد حساب مدیر شوید.");
  return apiFetch<AdminServiceOffer>("/marketplace/admin/services/", { method: "POST", body: JSON.stringify(input) }, true);
}

export async function updateAdminService(slug: string, input: Partial<AdminServiceOffer>) {
  if (!apiBase() || !accessToken()) throw new VillaOneApiError("برای ویرایش خدمت باید وارد حساب مدیر شوید.");
  return apiFetch<AdminServiceOffer>(`/marketplace/admin/services/${encodeURIComponent(slug)}/`, { method: "PATCH", body: JSON.stringify(input) }, true);
}

export async function fetchAdminServiceAvailability(slug: string, start: string, days = 30) {
  if (!apiBase() || !accessToken()) return null;
  return apiFetch<{ service: string; days: ServiceAvailabilityDay[] }>(`/marketplace/admin/services/${encodeURIComponent(slug)}/availability/?start=${encodeURIComponent(start)}&days=${days}`, {}, true);
}

export async function updateAdminServiceAvailability(slug: string, input: { dates: string[]; status: ServiceAvailabilityDay["status"]; capacity_override?: number | null; price_override?: number | null; admin_note?: string }) {
  if (!apiBase() || !accessToken()) throw new VillaOneApiError("برای ویرایش ظرفیت خدمت باید وارد حساب مدیر شوید.");
  return apiFetch<{ updated: number }>(`/marketplace/admin/services/${encodeURIComponent(slug)}/availability/`, { method: "PATCH", body: JSON.stringify(input) }, true);
}

export async function fetchAdminBookingServices(input: { status?: string; service?: string; query?: string } = {}) {
  if (!apiBase() || !accessToken()) return null;
  const query = new URLSearchParams();
  if (input.status && input.status !== "all") query.set("status", input.status);
  if (input.service) query.set("service", input.service);
  if (input.query?.trim()) query.set("q", input.query.trim());
  return apiFetch<AdminBookingService[]>(`/bookings/admin/service-items/${query.size ? `?${query.toString()}` : ""}`, {}, true);
}

export async function updateAdminBookingService(id: number, input: { status: AdminBookingService["status"]; admin_note?: string }) {
  if (!apiBase() || !accessToken()) throw new VillaOneApiError("برای پیگیری خدمت باید وارد حساب مدیر شوید.");
  return apiFetch<AdminBookingService>(`/bookings/admin/service-items/${id}/`, { method: "PATCH", body: JSON.stringify(input) }, true);
}

export async function createMarketplaceInquiry(input: { kind: "real_estate" | "contractor" | "service"; targetSlug: string; name: string; phone: string; message: string }) {
  if (!apiBase()) throw new VillaOneApiError("سامانه درخواست مشاوره در دسترس نیست.");
  return apiFetch<{ id: number; status: "new" }>("/marketplace/inquiries/", {
    method: "POST",
    body: JSON.stringify({
      kind: input.kind,
      listing_slug: input.kind === "real_estate" ? input.targetSlug : undefined,
      contractor_slug: input.kind === "contractor" ? input.targetSlug : undefined,
      service_slug: input.kind === "service" ? input.targetSlug : undefined,
      name: input.name,
      phone: input.phone,
      message: input.message,
    }),
  }, hasAuthenticatedSession());
}
