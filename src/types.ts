export type Material = "glass" | "mother-of-pearl";
export type ChannelKind = "website" | "whatsapp" | "instagram" | "facebook" | "tiktok";
export type ProductStatus = "published" | "draft";
export type ConversationStatus = "ai-handling" | "ready-for-handoff" | "with-employee" | "closed";
export type OrderStatus = "new" | "production" | "shipped" | "delivered" | "cancelled";
export type TaskStatus = "todo" | "in-progress" | "review" | "done";
export type StaffRole = "manager" | "agent";

/* A staff account as the browser sees it — never carries the password hash. */
export interface SessionUser {
  id: string;
  nameEn: string;
  nameAr: string;
  email: string;
  role: StaffRole;
  employeeId: string | null;
  active: boolean;
  mustChangePassword?: boolean;
}

export interface Product {
  id: string;
  sku: string;
  nameEn: string;
  nameAr: string;
  material: Material;
  category: string;
  priceEgp: number;
  stock: number;
  status: ProductStatus;
  descriptionEn: string;
  descriptionAr: string;
  imageUrl?: string;
  createdAt: string;
}

export interface Qualification {
  intent: string;
  interests: string[];
  quantity: number | null;
  budgetEgp: number | null;
  city: string | null;
  timeline: string | null;
  missing: string[];
  score: number;
  summaryEn: string;
  summaryAr: string;
}

export interface Message {
  id: string;
  from: "customer" | "ai" | "employee";
  text: string;
  at: string;
  lang: "en" | "ar";
  agent?: string;
  /* A catalog photo the desk sent with the message. */
  imageUrl?: string;
  imageName?: string;
}

export interface OrderSlotState {
  value: string | null;
  asked: number;
  labelEn?: string;
  labelAr?: string;
}

export interface OrderState {
  agent: string;
  slots: Record<string, OrderSlotState>;
  missing: string[];
  skipped: string[];
  turns: number;
  paused: boolean;
  /* The customer pushed back on the catalog price — only then is budget asked. */
  priceObjection?: boolean;
}

export interface Conversation {
  id: string;
  channel: ChannelKind;
  customerName: string;
  phone: string;
  lang: "en" | "ar";
  status: ConversationStatus;
  assignedTo: string | null;
  unread: boolean;
  qualification: Qualification;
  order?: OrderState;
  messages: Message[];
  lastAt: string;
  createdAt: string;
}

export interface OrderLine {
  key: string;
  labelEn: string;
  labelAr: string;
  valueEn: string;
  valueAr: string;
}

/* A confirmed order sheet, kept after the conversation is handed over so the
   team can track it and export it for the workshop. */
export interface OrderRecord {
  id: string;
  ref: string;
  conversationId: string | null;
  customerName: string;
  phone: string;
  channel: ChannelKind;
  lang: "en" | "ar";
  productEn: string;
  productAr: string;
  quantity: number | null;
  budgetEgp: number | null;
  city: string | null;
  lines: OrderLine[];
  openDetails: string[];
  agent: string;
  status: OrderStatus;
  assignedTo: string | null;
  confirmedAt: string;
  updatedAt: string;
}

export interface SalesChannel {
  id: string;
  nameEn: string;
  nameAr: string;
  kind: "marketplace" | "social" | "direct" | "physical";
  revenueEgp: number;
  orders: number;
  sessions: number;
  returns: number;
  adSpendEgp: number;
  changePct: number;
}

export interface Employee {
  id: string;
  nameEn: string;
  nameAr: string;
  roleEn: string;
  roleAr: string;
  online: boolean;
}

export interface Task {
  id: string;
  employeeId: string;
  titleEn: string;
  titleAr: string;
  kind: "enquiry" | "listing" | "content" | "dispatch" | "followup";
  status: TaskStatus;
  priority: "normal" | "high";
  dueAt: string;
  updatedAt: string;
}

/* A WhatsApp number the team added by hand to a coupon group. */
export interface CustomerContact {
  id: string;
  name: string;
  phone: string;
  addedAt: string;
  lastSentAt?: string;
}

/* One hand-built list of numbers that receives its own discount coupon. */
export interface CustomerGroup {
  id: string;
  nameEn: string;
  nameAr: string;
  discountPct: number;
  couponCode: string;
  contacts: CustomerContact[];
  createdAt: string;
  lastSentAt?: string;
}

export type ActivityKind = "ai" | "team" | "access";

export interface Activity {
  id: string;
  at: string;
  actor: string;
  kind?: ActivityKind;
  textEn: string;
  textAr: string;
  tone: "neutral" | "good" | "warn";
}

/* Older entries predate the kind field — read them through this. */
export function activityKind(entry: Activity): ActivityKind {
  return entry.kind ?? (entry.actor === "ai" ? "ai" : "team");
}

export interface Database {
  products: Product[];
  conversations: Conversation[];
  orders: OrderRecord[];
  channels: SalesChannel[];
  employees: Employee[];
  tasks: Task[];
  activity: Activity[];
  groups: CustomerGroup[];
}

export interface Analysis {
  headlineEn: string;
  headlineAr: string;
  wins: { en: string; ar: string }[];
  risks: { en: string; ar: string }[];
  actions: { en: string; ar: string }[];
  generatedBy: "ai" | "rules";
}

export interface Audit {
  headlineEn: string;
  headlineAr: string;
  flags: { employeeId: string | null; en: string; ar: string; severity: "high" | "medium" }[];
  generatedBy: "ai" | "rules";
}
