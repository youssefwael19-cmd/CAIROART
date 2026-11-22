import type { ChannelKind, Database, Employee, OrderStatus, SessionUser } from "./types";

export interface AppMeta {
  aiMode: "llm" | "rules";
  whatsapp: boolean;
  generatedAt: string;
}

export interface AppState {
  db: Database;
  meta: AppMeta;
}

/* The signed-in account travels only with the calls that establish a session. */
export interface SessionState extends AppState {
  user: SessionUser;
}

let onUnauthorized: (() => void) | null = null;

async function request<T>(path: string, init?: RequestInit, anonymous = false): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers || {}) },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (res.status === 401 && !anonymous) onUnauthorized?.();
  if (!res.ok) throw new Error((body as { error?: string }).error || `Request failed (${res.status})`);
  return body as T;
}

export const api = {
  onUnauthorized: (handler: () => void) => {
    onUnauthorized = handler;
  },
  state: () => request<SessionState>("/api/state"),
  login: (email: string, password: string) =>
    request<SessionState>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }, true),
  logout: () => request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }, true),
  authConfig: () => request<{ demo: boolean }>("/api/auth/config", undefined, true),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: boolean; user: SessionUser }>("/api/auth/password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  shareOrder: (id: string, lang: "en" | "ar") =>
    request<{ url: string; expiresInDays: number }>(`/api/orders/${id}/share?lang=${lang}`, { method: "POST" }),
  staff: () => request<{ staff: SessionUser[] }>("/api/staff"),
  createStaff: (payload: {
    nameEn: string;
    nameAr: string;
    email: string;
    role: "manager" | "agent";
    employeeId: string | null;
    password: string;
  }) => request<{ staff: SessionUser[]; user: SessionUser }>("/api/staff/create", { method: "POST", body: JSON.stringify(payload) }),
  createEmployee: (payload: { nameEn: string; nameAr: string; roleEn: string; roleAr: string }) =>
    request<AppState & { employee: Employee }>("/api/employees/create", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  setStaffActive: (id: string, active: boolean) =>
    request<{ staff: SessionUser[]; user: SessionUser }>("/api/staff/active", {
      method: "POST",
      body: JSON.stringify({ id, active }),
    }),
  setStaffPassword: (id: string, password: string) =>
    request<{ staff: SessionUser[]; user: SessionUser }>("/api/staff/password", {
      method: "POST",
      body: JSON.stringify({ id, password }),
    }),
  message: (conversationId: string, text: string, author: "customer" | "employee") =>
    request<AppState>("/api/inbox/message", { method: "POST", body: JSON.stringify({ conversationId, text, author }) }),
  handoff: (conversationId: string, employeeId: string) =>
    request<AppState>("/api/inbox/handoff", { method: "POST", body: JSON.stringify({ conversationId, employeeId }) }),
  newEnquiry: (payload: { channel: ChannelKind; name: string; phone?: string; text: string; lang: "en" | "ar" }) =>
    request<AppState & { conversationId: string }>("/api/inbox/new", { method: "POST", body: JSON.stringify(payload) }),
  command: (command: string) =>
    request<AppState & { ok: boolean; replyEn: string; replyAr: string }>("/api/command", {
      method: "POST",
      body: JSON.stringify({ command }),
    }),
  updateOrder: (id: string, patch: { status?: OrderStatus; assignedTo?: string | null }) =>
    request<AppState>("/api/orders/update", { method: "POST", body: JSON.stringify({ id, ...patch }) }),
  ordersCsvUrl: (lang: "en" | "ar") => `/api/orders/export.csv?lang=${lang}`,
  orderPrintUrl: (id: string, lang: "en" | "ar") => `/api/orders/${id}/print?lang=${lang}`,
  uploadProduct: async (form: FormData) => {
    const res = await fetch("/api/products/upload", { method: "POST", body: form });
    const body = (await res.json().catch(() => ({}))) as AppState & {
      productId: string;
      cutout: boolean;
      error?: string;
    };
    if (!res.ok) throw new Error(body.error || `Upload failed (${res.status})`);
    return body;
  },
  toggleProduct: (id: string) =>
    request<AppState>("/api/products/toggle", { method: "POST", body: JSON.stringify({ id }) }),
  sales: () => request<{ analysis: import("./types").Analysis }>("/api/ai/sales", { method: "POST" }),
  audit: () => request<{ audit: import("./types").Audit }>("/api/ai/audit", { method: "POST" }),
  digest: () =>
    request<{
      digest: { headlineEn: string; headlineAr: string; bulletsEn: string[]; bulletsAr: string[]; generatedBy: string };
    }>("/api/ai/digest", { method: "POST" }),
  taskStatus: (id: string, status: import("./types").TaskStatus) =>
    request<AppState>("/api/tasks/status", { method: "POST", body: JSON.stringify({ id, status }) }),
  createGroup: (payload: { nameEn: string; nameAr: string; discountPct: number; couponCode?: string }) =>
    request<AppState>("/api/groups/create", { method: "POST", body: JSON.stringify(payload) }),
  addContact: (groupId: string, payload: { name: string; phone: string }) =>
    request<AppState>("/api/groups/contact", { method: "POST", body: JSON.stringify({ groupId, ...payload }) }),
  removeContact: (groupId: string, contactId: string) =>
    request<AppState>("/api/groups/contact/remove", { method: "POST", body: JSON.stringify({ groupId, contactId }) }),
  sendGroup: (groupId: string) =>
    request<AppState & { sent: number; total: number; failed: number; simulated: boolean }>("/api/groups/send", {
      method: "POST",
      body: JSON.stringify({ groupId }),
    }),
};
