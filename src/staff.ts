import type { SessionUser } from "./types";

/* The team roster the app starts with. Passwords exist only so the team can
   sign in to the prototype — change them (data/staff.json) before real use. */
export const DEMO_STAFF: (SessionUser & { password: string })[] = [
  {
    id: "usr_manager",
    nameEn: "Youssef Wael",
    nameAr: "يوسف وائل",
    email: "youssef@cairoart.net",
    role: "manager",
    employeeId: null,
    active: true,
    password: "CairoArt#2026",
  },
  {
    id: "usr_yasmine",
    nameEn: "Yasmine Kamal",
    nameAr: "ياسمين كمال",
    email: "yasmine@cairoart.net",
    role: "agent",
    employeeId: "emp_1",
    active: true,
    password: "Yasmine#2026",
  },
  {
    id: "usr_ahmed",
    nameEn: "Ahmed Sobhy",
    nameAr: "أحمد صبحي",
    email: "ahmed@cairoart.net",
    role: "agent",
    employeeId: "emp_2",
    active: true,
    password: "Ahmed#2026",
  },
];
