import assert from "node:assert/strict";
import test from "node:test";
import { extractBudget, extractQuantity } from "../server/ai";
import { ordersCsv } from "../server/orders";
import { orderConfirmationHtml } from "../server/print";
import { shareToken, verifyShareToken } from "../server/share";
import type { Database, OrderRecord } from "../src/types";

const now = new Date().toISOString();

function order(patch: Partial<OrderRecord> = {}): OrderRecord {
  return {
    id: "ord_1",
    ref: "CA-2026-1001",
    conversationId: null,
    customerName: "Mariam Adel",
    phone: "+20 100 000 0000",
    channel: "website",
    lang: "en",
    productEn: "Tall ribbed vase",
    productAr: "فازة طويلة مضلعة",
    quantity: 2,
    budgetEgp: 3000,
    city: "Cairo",
    lines: [],
    openDetails: [],
    agent: "intake",
    status: "new",
    assignedTo: null,
    confirmedAt: now,
    updatedAt: now,
    ...patch,
  };
}

function database(orders: OrderRecord[]): Database {
  return {
    products: [],
    conversations: [],
    orders,
    channels: [],
    employees: [],
    tasks: [],
    activity: [],
    groups: [],
  };
}

test("Arabic-Indic digits are understood by the agents", () => {
  assert.equal(extractQuantity("عايزة ٢ طقم للهدايا"), 2);
  assert.equal(extractQuantity("محتاج ١٢ كوب"), 12);
  assert.equal(extractBudget("الميزانية ١٢٠٠ جنيه"), 1200);
  assert.equal(extractBudget("budget is 3,500 egp"), 3500);
});

test("CSV export neutralises formula injection", () => {
  const csv = ordersCsv(database([order({ customerName: '=HYPERLINK("http://evil.example","click")' })]), "en");
  assert.ok(csv.includes("'=HYPERLINK"), "the formula is prefixed with an apostrophe");
  assert.ok(!csv.includes('"=HYPERLINK'), "no cell starts with a live formula");
});

test("CSV export still quotes commas and quotes", () => {
  const csv = ordersCsv(database([order({ customerName: 'Adel, "The" Boss' })]), "en");
  assert.ok(csv.includes('"Adel, ""The"" Boss"'));
});

test("customer confirmation links are signed, scoped and expiring", () => {
  const token = shareToken("ord_1", 60_000);
  assert.equal(verifyShareToken("ord_1", token), true);
  assert.equal(verifyShareToken("ord_2", token), false);
  assert.equal(verifyShareToken("ord_1", `${token}x`), false);
  assert.equal(verifyShareToken("ord_1", shareToken("ord_1", -1_000)), false);
  assert.equal(verifyShareToken("ord_1", undefined), false);
});

test("the printed sheet escapes customer-supplied text", () => {
  const html = orderConfirmationHtml(
    database([]),
    order({ customerName: '<script>alert("x")</script>', city: "<img src=x onerror=alert(1)>" }),
    "en",
  );
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes("<script>alert"));
  assert.ok(!html.includes("<img src=x"));
});
