import type { Lang } from "./i18n";
import type { ChannelKind, OrderStatus, TaskStatus } from "./types";

export type View = "overview" | "inbox" | "groups" | "orders" | "catalog" | "sales" | "team";
export type Tfn = (key: string) => string;

export interface Actions {
  send: (conversationId: string, text: string, author: "customer" | "employee") => Promise<void>;
  handoff: (conversationId: string, employeeId: string) => Promise<void>;
  newEnquiry: (payload: {
    channel: ChannelKind;
    name: string;
    phone?: string;
    text: string;
    lang: Lang;
  }) => Promise<string | undefined>;
  command: (raw: string) => Promise<{ ok: boolean; text: string }>;
  updateOrder: (id: string, patch: { status?: OrderStatus; assignedTo?: string | null }) => Promise<void>;
  toggle: (id: string) => Promise<void>;
  uploadProduct: (form: FormData) => Promise<{ productId: string; cutout: boolean } | undefined>;
  taskStatus: (id: string, status: TaskStatus) => Promise<void>;
  createGroup: (payload: { nameEn: string; nameAr: string; discountPct: number; couponCode?: string }) => Promise<boolean>;
  addContact: (groupId: string, payload: { name: string; phone: string }) => Promise<boolean>;
  createEmployee: (payload: { nameEn: string; nameAr: string; roleEn: string; roleAr: string }) => Promise<boolean>;
  removeContact: (groupId: string, contactId: string) => Promise<void>;
  sendGroup: (groupId: string) => Promise<{ sent: number; total: number; failed: number; simulated: boolean } | undefined>;
  loadSales: () => Promise<void>;
  loadAudit: () => Promise<void>;
  loadDigest: () => Promise<void>;
  goInbox: (conversationId: string) => void;
  toast: (text: string, ok?: boolean) => void;
}
