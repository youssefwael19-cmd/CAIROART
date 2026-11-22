import { useMemo, useState } from "react";
import type { Actions, Tfn } from "../contract";
import { categoryLabel, fmtEgp, type Lang } from "../i18n";
import type { Database, Material, StaffRole } from "../types";
import { Badge, Btn, Card, Empty, Icon, SectionLabel, Stat } from "../ui";

interface Props {
  db: Database;
  t: Tfn;
  lang: Lang;
  actions: Actions;
  role: StaffRole;
}

const EXAMPLES_EN = ["add glass vase, 1200 EGP, stock 20", "publish GLS-TEA-01", "set price of GLS-VAS-01 to 1950", "create task for Ahmed: photograph the new trays"];
const EXAMPLES_AR = ["أضف فازة زجاج ١٢٠٠ جنيه مخزون ٢٠", "انشر GLS-TEA-01", "سعر GLS-VAS-01 1950", "أنشئ مهمة لأحمد: تصوير الصواني الجديدة"];

export default function Catalog({ db, t, lang, actions, role }: Props) {
  const canManage = role === "manager";
  const [material, setMaterial] = useState<"all" | Material>("all");
  const [query, setQuery] = useState("");
  const [command, setCommand] = useState("");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  const products = useMemo(() => {
    const q = query.trim().toLowerCase();
    return db.products.filter((p) => {
      if (material !== "all" && p.material !== material) return false;
      if (!q) return true;
      return (
        p.nameEn.toLowerCase().includes(q) ||
        p.nameAr.includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q)
      );
    });
  }, [db.products, material, query]);

  const published = db.products.filter((p) => p.status === "published").length;
  const stockValue = db.products.reduce((s, p) => s + p.priceEgp * p.stock, 0);

  async function run(cmd?: string) {
    const value = (cmd ?? command).trim();
    if (!value || busy) return;
    setBusy(true);
    try {
      const res = await actions.command(value);
      setResult(res);
      setCommand("");
    } catch (e) {
      setResult({ ok: false, text: (e as Error).message });
    }
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <SectionLabel>{t("nav.catalog")}</SectionLabel>
          <h1 className="mt-1 font-display text-[28px] leading-tight tracking-tight sm:text-[32px]">{t("catalog.title")}</h1>
          <p className="mt-1 max-w-2xl text-[12.5px] text-ink-3">{t("catalog.subtitle")}</p>
        </div>
        {canManage ? (
          <Btn variant="brass" onClick={() => setShowUpload(true)}>
            <Icon name="plus" className="h-3.5 w-3.5" />
            {t("catalog.upload")}
          </Btn>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-line-2 bg-card px-2 py-1 text-[10.5px] text-ink-3">
            <Icon name="lock" className="h-3 w-3" />
            {t("auth.catalogHint")}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t("catalog.total")} value={db.products.length} hint={`${db.products.filter((p) => p.material === "glass").length} glass · ${db.products.filter((p) => p.material === "mother-of-pearl").length} pearl`} />
        <Stat label={t("catalog.liveCount")} value={published} accent="good" hint={`${db.products.length - published} ${t("catalog.draft").toLowerCase()}`} />
        <Stat label={t("catalog.value")} value={fmtEgp(stockValue, lang)} hint={`${db.products.reduce((s, p) => s + p.stock, 0)} ${t("common.pieces")}`} />
        <Stat label={t("catalog.draft")} value={db.products.length - published} accent={db.products.length - published ? "brass" : "ink"} />
      </div>

      {canManage && (
      <Card className="overflow-hidden border-line-2 bg-bone-2/50">
        <div className="p-4">
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded bg-ink text-bone"><Icon name="terminal" className="h-3.5 w-3.5" /></span>
            <SectionLabel>{t("catalog.command")}</SectionLabel>
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void run();
              }}
              placeholder={t("catalog.placeholder")}
              className="flex-1 rounded-lg border border-line-2 bg-card px-3 py-2.5 text-[13px] outline-none placeholder:text-ink-3/60 focus:border-brass"
            />
            <Btn variant="brass" onClick={() => void run()} disabled={busy || !command.trim()} className="shrink-0">
              <Icon name={busy ? "refresh" : "arrow"} className="h-3.5 w-3.5 rtl:rotate-180" />
              {t("catalog.run")}
            </Btn>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-[0.14em] text-ink-3">{t("catalog.examples")}</span>
            {(lang === "ar" ? EXAMPLES_AR : EXAMPLES_EN).map((ex) => (
              <button
                key={ex}
                onClick={() => void run(ex)}
                className="rounded-md border border-line-2 bg-card/70 px-2 py-0.5 text-[10.5px] text-ink-3 transition-colors hover:border-brass hover:text-brass-2"
              >
                {ex}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[10.5px] text-ink-3/80">{t("catalog.commandHint")}</p>

          {result && (
            <div
              className={`mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-[11.5px] leading-snug ${
                result.ok ? "border-good/25 bg-good-soft text-good" : "border-alert/25 bg-alert-soft text-alert"
              }`}
            >
              <Icon name={result.ok ? "check" : "alert"} className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{result.text}</span>
            </div>
          )}
        </div>
      </Card>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border border-line-2 bg-card p-0.5">
          {([
            ["all", t("common.all")],
            ["glass", t("catalog.material.glass")],
            ["mother-of-pearl", t("catalog.material.pearl")],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setMaterial(value)}
              className={`rounded px-2.5 py-1 text-[11.5px] transition-colors ${
                material === value ? "bg-ink text-bone" : "text-ink-3 hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative ms-auto w-full sm:w-64">
          <Icon name="search" className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-3/60" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("catalog.search")}
            className="w-full rounded-md border border-line-2 bg-card py-1.5 pe-2.5 ps-8 text-[12px] outline-none placeholder:text-ink-3/60 focus:border-brass"
          />
        </div>
      </div>

      {products.length === 0 ? (
        <Empty>{t("catalog.empty")}</Empty>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {products.map((p) => (
            <Card key={p.id} className="group flex flex-col p-4">
              {p.imageUrl && (
                <img
                  src={p.imageUrl}
                  alt={lang === "ar" ? p.nameAr : p.nameEn}
                  loading="lazy"
                  className="mb-3 aspect-square w-full rounded-lg border border-line object-cover"
                />
              )}
              <div className="flex items-start justify-between gap-2">
                <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-3/70">{p.sku}</div>
                <Badge tone={p.status === "published" ? "good" : "neutral"}>
                  {p.status === "published" ? t("catalog.published") : t("catalog.draft")}
                </Badge>
              </div>
              <h3 className="mt-2 font-display text-[15.5px] leading-snug text-ink">
                {lang === "ar" ? p.nameAr : p.nameEn}
              </h3>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <Badge tone={p.material === "glass" ? "glass" : "pearl"}>
                  {p.material === "glass" ? t("catalog.material.glass") : t("catalog.material.pearl")}
                </Badge>
                <span className="text-[10.5px] text-ink-3">{categoryLabel(p.category, lang)}</span>
              </div>
              <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-ink-3">
                {lang === "ar" ? p.descriptionAr : p.descriptionEn}
              </p>
              <div className="mt-auto flex items-end justify-between gap-2 pt-3">
                <div>
                  <div className="font-display text-[17px] leading-none">{fmtEgp(p.priceEgp, lang)}</div>
                  <div className={`mt-1 text-[10.5px] ${p.stock > 5 ? "text-ink-3" : "text-alert"}`}>
                    {p.stock} {t("catalog.stock")}
                  </div>
                </div>
                {canManage && (
                  <Btn variant="outline" size="sm" onClick={() => void actions.toggle(p.id)}>
                    <Icon name={p.status === "published" ? "close" : "check"} className="h-3 w-3" />
                    {p.status === "published" ? t("catalog.hide") : t("catalog.publish")}
                  </Btn>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {canManage && showUpload && (
        <UploadProductDialog onClose={() => setShowUpload(false)} actions={actions} t={t} lang={lang} />
      )}
    </div>
  );
}

function UploadProductDialog({
  onClose,
  actions,
  t,
  lang,
}: {
  onClose: () => void;
  actions: Actions;
  t: Tfn;
  lang: Lang;
}) {
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [nameEn, setNameEn] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [material, setMaterial] = useState<Material>("glass");
  const [category, setCategory] = useState("vases");
  const [busy, setBusy] = useState(false);

  function pick(file: File | null) {
    if (preview) URL.revokeObjectURL(preview);
    setPhoto(file);
    setPreview(file ? URL.createObjectURL(file) : null);
  }

  async function submit() {
    if (!photo || !nameEn.trim() || !nameAr.trim() || !price.trim() || busy) return;
    setBusy(true);
    const form = new FormData();
    form.set("photo", photo);
    form.set("nameEn", nameEn.trim());
    form.set("nameAr", nameAr.trim());
    form.set("priceEgp", price.trim());
    form.set("stock", stock.trim() || "0");
    form.set("material", material);
    form.set("category", category.trim() || "vases");
    const saved = await actions.uploadProduct(form);
    setBusy(false);
    if (saved) onClose();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[88vh] w-full max-w-lg overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <SectionLabel>{t("catalog.upload")}</SectionLabel>
              <h3 className="mt-1 font-display text-[19px]">{t("catalog.uploadTitle")}</h3>
            </div>
            <button onClick={onClose} className="text-ink-3 hover:text-ink">
              <Icon name="close" className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-1.5 text-[11px] leading-snug text-ink-3">{t("catalog.uploadNote")}</p>

          <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-line-2 bg-bone/40 p-3">
            {preview ? (
              <img src={preview} alt="" className="h-16 w-16 shrink-0 rounded-md border border-line object-cover" />
            ) : (
              <span className="grid h-16 w-16 shrink-0 place-items-center rounded-md bg-bone-2 text-ink-3">
                <Icon name="catalog" className="h-5 w-5" />
              </span>
            )}
            <div className="min-w-0">
              <div className="text-[12px] font-medium">{t("catalog.photo")}</div>
              <div className="mt-0.5 truncate text-[10.5px] text-ink-3">{photo ? photo.name : t("catalog.photoHint")}</div>
            </div>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => pick(e.target.files?.[0] ?? null)}
            />
          </label>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[10.5px] uppercase tracking-[0.12em] text-ink-3">{t("catalog.nameEn")}</span>
              <input
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                placeholder="Pearl Inlay Tray — Large"
                className="mt-1 w-full rounded-lg border border-line bg-bone/40 px-3 py-2 text-[12.5px] outline-none focus:border-brass"
              />
            </label>
            <label className="block">
              <span className="text-[10.5px] uppercase tracking-[0.12em] text-ink-3">{t("catalog.nameAr")}</span>
              <input
                value={nameAr}
                onChange={(e) => setNameAr(e.target.value)}
                placeholder="صينية صدف — كبيرة"
                className="mt-1 w-full rounded-lg border border-line bg-bone/40 px-3 py-2 text-[12.5px] outline-none focus:border-brass"
              />
            </label>
            <label className="block">
              <span className="text-[10.5px] uppercase tracking-[0.12em] text-ink-3">{t("catalog.price")}</span>
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                inputMode="numeric"
                placeholder="3400"
                className="mt-1 w-full rounded-lg border border-line bg-bone/40 px-3 py-2 text-[12.5px] outline-none focus:border-brass"
              />
            </label>
            <label className="block">
              <span className="text-[10.5px] uppercase tracking-[0.12em] text-ink-3">{t("catalog.stockLabel")}</span>
              <input
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                inputMode="numeric"
                placeholder="12"
                className="mt-1 w-full rounded-lg border border-line bg-bone/40 px-3 py-2 text-[12.5px] outline-none focus:border-brass"
              />
            </label>
            <label className="block">
              <span className="text-[10.5px] uppercase tracking-[0.12em] text-ink-3">{t("catalog.materialLabel")}</span>
              <select
                value={material}
                onChange={(e) => setMaterial(e.target.value as Material)}
                className="mt-1 w-full rounded-lg border border-line bg-bone/40 px-2.5 py-2 text-[12.5px] outline-none focus:border-brass"
              >
                <option value="glass">{t("catalog.material.glass")}</option>
                <option value="mother-of-pearl">{t("catalog.material.pearl")}</option>
              </select>
            </label>
            <label className="block">
              <span className="text-[10.5px] uppercase tracking-[0.12em] text-ink-3">{t("catalog.category")}</span>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="trays"
                className="mt-1 w-full rounded-lg border border-line bg-bone/40 px-3 py-2 text-[12.5px] outline-none focus:border-brass"
              />
            </label>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Btn variant="ghost" onClick={onClose}>{t("common.none")}</Btn>
            <Btn onClick={submit} disabled={busy || !photo || !nameEn.trim() || !nameAr.trim() || !price.trim()}>
              <Icon name={busy ? "refresh" : "sparkle"} className="h-3.5 w-3.5" />
              {busy ? t("catalog.processing") : t("catalog.save")}
            </Btn>
          </div>
        </Card>
      </div>
    </div>
  );
}
