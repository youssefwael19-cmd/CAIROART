import type { Database, TaskStatus } from "../src/types";

const now = Date.now();
const iso = (days: number, hours = 0) =>
  new Date(now + days * 86_400_000 + hours * 3_600_000).toISOString();

export function seedDatabase(): Database {
  const products: Database["products"] = [
    ["GLS-TEA-01", "Hand-blown Tea Set — Amber Swirl", "طقم شاي منفوخ يدويًا — أمبر", "glass", "tea sets", 4850, 14, "published", "Six hand-blown glasses with amber trails and a matching decanter. Each set is shaped at the furnace by a single artisan.", "ستة أكواب منفوخة يدويًا بخطوط كهرمانية مع دورق مطابق. كل طقم يُشكّل عند الفرن على يد صانع واحد."],
    ["GLS-COF-01", "Arabic Coffee Set — Smoke Grey", "طقم قهوة عربي — رمادي دخاني", "glass", "coffee sets", 5600, 9, "published", "Dallah, six finjan cups and a serving tray in smoked glass with hand-polished rims.", "دلة وستة فناجين وصينية تقديم من الزجاج الدخاني بحواف مصقولة يدويًا."],
    ["GLS-PRF-01", "Perfume Oil Bottle — Teardrop", "زجاجة عطر — دمعة", "glass", "perfume oil bottles", 320, 140, "published", "Thick-walled 6ml teardrop bottle with a ground-glass stopper. Sold individually or in gift boxes.", "زجاجة دمعة ٦ مل بجدار سميك وسدادة زجاجية مصنوّعة. تُباع منفردة أو في علب هدايا."],
    ["GLS-PRF-02", "Perfume Oil Bottle — Faceted Mini", "زجاجة عطر — صغيرة متعددة الأوجه", "glass", "perfume oil bottles", 260, 210, "published", "Faceted 3ml mini bottle, ideal for sampled oud and attar blends.", "زجاجة صغيرة ٣ مل متعددة الأوجه، مناسبة لعينات العود والعطر."],
    ["GLS-AQU-01", "Curved Glass Aquarium — 60cm", "حوض سمك زجاجي منحني — ٦٠ سم", "glass", "fish tanks", 9800, 4, "published", "Bent-glass aquarium with a seamless front curve, 8mm walls and a slim black base.", "حوض بزجاج منحني أمامي بلا وصلات، سماكة ٨ مم وقاعدة سوداء رفيعة."],
    ["GLS-PLT-01", "Bubble Glass Plant Pot", "أصيص نبات من الزجاج الفقاعي", "glass", "plant pots", 640, 46, "published", "Mouth-blown pot with trapped air bubbles, sized for herbs and small monsteras.", "أصيص منفوخ بالفم بحبكات هواء محبوسة، مناسب للأعشاب والمونستيرا الصغيرة."],
    ["GLS-DFU-01", "Reed Diffuser Vessel — Frosted", "وعاء موزع عطر — مصنفر", "glass", "perfume oil diffusers", 450, 88, "published", "Frosted 200ml vessel with a brass collar and eight natural rattan reeds.", "وعاء مصنفر ٢٠٠ مل بطوق نحاسي وثمانية أعواد راتان طبيعية."],
    ["GLS-INC-01", "Glass Incense Burner — Brass Base", "مبخر زجاجي — قاعدة نحاسية", "glass", "incense burners", 890, 31, "published", "Heat-resistant glass bowl on a spun brass base, for bakhoor and oud chips.", "وعاء زجاجي مقاوم للحرارة على قاعدة نحاسية مخروطة، للبخور وقطع العود."],
    ["GLS-MOD-01", "Handcrafted Glass Falcon Model", "مجسم صقر من الزجاج", "glass", "glass models", 3200, 7, "published", "A lampworked falcon, built flame by flame without moulds. Signed by the artisan.", "صقر مُشكّل باللهب دون قوالب. موقّع من الصانع."],
    ["GLS-CHN-01", "Petal Chandelier — Six Arm", "نجفة بتلات — ستة أذرع", "glass", "chandeliers", 24500, 3, "published", "Six hand-pressed glass petals on an aged brass frame. Made to order in four to six weeks.", "ست بتلات زجاجية مضغوطة يدويًا على إطار نحاسي عتيق. تُصنع حسب الطلب في أربعة إلى ستة أسابيع."],
    ["GLS-VAS-01", "Tall Ribbed Vase — Cobalt", "فازة طويلة مضلعة — كوبالت", "glass", "vases", 1750, 22, "published", "Seventy-centimetre vase in cobalt with hand-drawn ribs and an uneven, wabi-sabi lip.", "فازة بطول ٧٠ سم بلون كوبالت وأضلاع مشدودة يدويًا وحافة غير منتظمة."],
    ["GLS-CND-01", "Candlestick Holder Pair — Clear", "زوج شمعدان — شفاف", "glass", "candlestick holders", 1100, 34, "published", "A pair of weighted clear holders that fit standard taper candles.", "زوج من الشمعدانات الشفافة الثقيلة يناسب الشموع الرفيعة القياسية."],
    ["GLS-PND-01", "Glass Pendant Light — Dome", "معلق زجاجي — قبة", "glass", "pendants", 2900, 12, "published", "Opal dome pendant, 25cm, with a two-metre braided cord.", "معلق قبة بلون أوبال ٢٥ سم مع سلك مجدول بطول مترين."],

    ["MOP-TBL-01", "Mother of Pearl Inlay Table — Hexagon", "طاولة صدف مطعّم — سداسية", "mother-of-pearl", "tables", 18500, 2, "published", "Hexagonal walnut table inlaid with 1,400 hand-cut pearl tiles. Six to eight weeks to build.", "طاولة جوز سداسية مطعّمة بـ ١٤٠٠ بلاطة صدف مقطوعة يدويًا. تُنفّذ في ستة إلى ثمانية أسابيع."],
    ["MOP-TRY-01", "Pearl Inlay Serving Tray — Large", "صينية تقديم صدف — كبيرة", "mother-of-pearl", "trays", 3400, 11, "published", "Large scalloped tray, pearl mosaic in a palm-leaf pattern with brass handles.", "صينية كبيرة بحواف مموجة، فسيفساء صدف بنمط سعف النخيل ومقابض نحاسية."],
    ["MOP-TEA-01", "Mother of Pearl Tea Set", "طقم شاي صدف", "mother-of-pearl", "tea sets", 6200, 5, "published", "Pearl-inlaid tray with six cups and coasters, finished with a protective lacquer.", "صينية مطعّمة بالصدف مع ستة أكواب وقواعد، بطبقة ورنيش حامية."],
    ["MOP-COF-01", "Arabian Coffee Set — Pearl Inlay", "طقم قهوة عربي — طعمة صدف", "mother-of-pearl", "arabian coffee sets", 7400, 6, "published", "Dallah, six cups and a lidded sugar bowl set into a pearl-inlaid serving board.", "دلة وستة فناجين وسكرية بغطاء على لوح تقديم مطعّم بالصدف."],
    ["MOP-CUP-01", "Cup & Coaster Set of Six", "طقم أكواب وقواعد — ستة", "mother-of-pearl", "cups with coasters", 2850, 18, "published", "Six glass cups with individual pearl coasters in a lined presentation box.", "ستة أكواب زجاجية مع قواعد صدف منفردة في علبة تقديم مبطنة."],
    ["MOP-CST-01", "Coaster Set of Four — Geometric", "طقم قواعد — أربعة — هندسي", "mother-of-pearl", "coasters", 950, 52, "published", "Four square coasters in a geometric pearl star pattern, cork backed.", "أربع قواعد مربعة بنمط نجمة صدف هندسي وقاعدة فلين."],
    ["MOP-INC-01", "Pearl Incense Burner", "مبخر صدف", "mother-of-pearl", "incense burners", 1400, 16, "published", "Pearl-clad burner with a brass bowl insert and a fitted lid.", "مبخر مغطى بالصدف بوعاء نحاسي داخلي وغطاء مطابق."],
    ["MOP-BGM-01", "Backgammon Board — Walnut & Pearl", "طاولة طاولة (سيجة) — جوز وصدف", "mother-of-pearl", "backgammon", 12500, 3, "published", "Folding walnut backgammon board with a pearl star inlay, 48cm, with wooden checkers.", "طاولة سيجة جوز قابلة للطي بتطعيم نجمة صدف، ٤٨ سم، مع أحجار خشبية."],
    ["MOP-CHS-01", "Chess Board — Pearl & Ebony", "رقعة شطرنج — صدف وأبنوس", "mother-of-pearl", "chess board", 11200, 2, "published", "Pearl and ebony squares under a glass-smooth lacquer, with weighted pieces.", "مربعات صدف وأبنوس تحت ورنيش أملس كالزجاج، مع قطع موزونة."],
    ["MOP-JBW-01", "Jewelry Box — Velvet Lined", "علبة مجوهرات — مبطنة بالمخمل", "mother-of-pearl", "jewelry boxes", 2200, 9, "published", "Pearl-inlaid lid over a cedar body and a velvet-lined interior with two trays.", "غطاء مطعّم بالصدف على جسم من الأرز وداخل مبطن بالمخمل بصينيتين."],
    ["MOP-LMP-01", "Table Lamp — Mosaic Pearl", "أباجورة — فسيفساء صدف", "mother-of-pearl", "table lamps", 5600, 4, "published", "Mosaic pearl shade that throws a warm, shifting light across a room.", "غطاء فسيفساء صدف يبث ضوءًا دافئًا متغيرًا في الغرفة."],
  ].map((p) => {
    const [sku, nameEn, nameAr, material, category, priceEgp, stock, status, descriptionEn, descriptionAr] = p as [
      string, string, string, "glass" | "mother-of-pearl", string, number, number, "published", string, string,
    ];
    return {
      id: `prd_${sku.toLowerCase()}`,
      sku, nameEn, nameAr, material, category, priceEgp, stock, status,
      descriptionEn, descriptionAr, createdAt: iso(-60),
    };
  });

  const conversations: Database["conversations"] = [
    {
      id: "cnv_1",
      channel: "whatsapp",
      customerName: "Mariam Adel",
      phone: "+20 100 442 8891",
      lang: "ar",
      status: "ai-handling",
      assignedTo: null,
      unread: true,
      qualification: emptyQual(),
      messages: [
        { id: "m1", from: "customer", lang: "ar", text: "مساء الخير، شفت طقم الشاي الأمبر على الموقع. بكام؟", at: iso(0, -3) },
      ],
      lastAt: iso(0, -3),
      createdAt: iso(0, -3),
    },
    {
      id: "cnv_2",
      channel: "whatsapp",
      customerName: "Karim Fouad",
      phone: "+20 122 005 7714",
      lang: "en",
      status: "ai-handling",
      assignedTo: null,
      unread: true,
      qualification: emptyQual(),
      messages: [
        { id: "m2", from: "customer", lang: "en", text: "Hi, I run a gift shop in Zamalek. Can you supply 40 perfume oil bottles, teardrop style, with our logo on the box?", at: iso(0, -7) },
      ],
      lastAt: iso(0, -7),
      createdAt: iso(0, -7),
    },
    {
      id: "cnv_3",
      channel: "website",
      customerName: "Nour Hassan",
      phone: "+20 111 876 3300",
      lang: "en",
      status: "ready-for-handoff",
      assignedTo: null,
      unread: true,
      qualification: emptyQual(),
      messages: [
        { id: "m3", from: "customer", lang: "en", text: "I'm furnishing a villa in New Cairo and need the petal chandelier plus two tall vases for the entrance.", at: iso(-1, -5) },
        { id: "m4", from: "ai", lang: "en", text: "Lovely project. The petal chandelier is made to order in four to six weeks. How many chandeliers do you need, and which city are we delivering to?", at: iso(-1, -4) },
        { id: "m5", from: "customer", lang: "en", text: "One chandelier, and the two vases. Delivery to New Cairo, and I need it all before the 20th of next month.", at: iso(-1, -2) },
      ],
      lastAt: iso(-1, -2),
      createdAt: iso(-1, -5),
    },
    {
      id: "cnv_4",
      channel: "website",
      customerName: "Dina Samir",
      phone: "+20 128 339 0022",
      lang: "ar",
      status: "ai-handling",
      assignedTo: null,
      unread: false,
      qualification: emptyQual(),
      messages: [
        { id: "m6", from: "customer", lang: "ar", text: "عايزة طاولة سيجة صدف هدية لجوزي، في منها متاح؟", at: iso(-2, -6) },
      ],
      lastAt: iso(-2, -6),
      createdAt: iso(-2, -6),
    },
    {
      id: "cnv_5",
      channel: "website",
      customerName: "Hala Mostafa",
      phone: "+20 100 771 6655",
      lang: "en",
      status: "with-employee",
      assignedTo: "emp_1",
      unread: false,
      qualification: emptyQual(),
      messages: [
        { id: "m7", from: "customer", lang: "en", text: "Do you make custom aquariums for restaurants? We need a long one for a counter in Maadi.", at: iso(-3, -8) },
        { id: "m8", from: "ai", lang: "en", text: "We do build to size — the curved 60cm is our standard, and larger tanks are made to order. How long is the counter, and roughly what budget did you have in mind?", at: iso(-3, -7) },
        { id: "m9", from: "customer", lang: "en", text: "About 180cm. Budget is flexible if the finish is right.", at: iso(-3, -4) },
        { id: "m10", from: "employee", lang: "en", text: "Hi Hala, Yasmine here — I'll send you two sketches and a quote for a 180cm tank today.", at: iso(-3, -2) },
      ],
      lastAt: iso(-3, -2),
      createdAt: iso(-3, -8),
    },
    {
      id: "cnv_6",
      channel: "instagram",
      customerName: "Layla Hany",
      phone: "@laylahany",
      lang: "en",
      status: "ai-handling",
      assignedTo: null,
      unread: true,
      qualification: emptyQual(),
      messages: [
        { id: "m11", from: "customer", lang: "en", text: "Saw the pearl jewelry box in your reel — is it still available? I need it as a birthday gift in Heliopolis.", at: iso(0, -4) },
      ],
      lastAt: iso(0, -4),
      createdAt: iso(0, -4),
    },
    {
      id: "cnv_7",
      channel: "facebook",
      customerName: "Mostafa Ali",
      phone: "facebook.com/mostafa.ali",
      lang: "ar",
      status: "ai-handling",
      assignedTo: null,
      unread: true,
      qualification: emptyQual(),
      messages: [
        { id: "m12", from: "customer", lang: "ar", text: "عندكم نجفة كبيرة لفيلا؟ وهل ممكن نشوفها في المعرض؟", at: iso(-1, -3) },
      ],
      lastAt: iso(-1, -3),
      createdAt: iso(-1, -3),
    },
  ];

  const channels: Database["channels"] = [
    { id: "ch_web", nameEn: "cairoart.com", nameAr: "cairoart.com", kind: "direct", revenueEgp: 186_400, orders: 42, sessions: 5_200, returns: 2, adSpendEgp: 12_000, changePct: 14 },
    { id: "ch_wa", nameEn: "WhatsApp Business", nameAr: "واتساب بيزنس", kind: "social", revenueEgp: 142_800, orders: 58, sessions: 2_400, returns: 1, adSpendEgp: 0, changePct: 31 },
    { id: "ch_ig", nameEn: "Instagram", nameAr: "إنستجرام", kind: "social", revenueEgp: 118_600, orders: 39, sessions: 9_800, returns: 4, adSpendEgp: 9_500, changePct: 22 },
    { id: "ch_fb", nameEn: "Facebook", nameAr: "فيسبوك", kind: "social", revenueEgp: 74_200, orders: 21, sessions: 6_400, returns: 3, adSpendEgp: 5_800, changePct: -6 },
    { id: "ch_tt", nameEn: "TikTok Shop", nameAr: "تيك توك شوب", kind: "social", revenueEgp: 96_800, orders: 47, sessions: 21_500, returns: 9, adSpendEgp: 14_200, changePct: 41 },
  ];

  const employees: Database["employees"] = [
    { id: "emp_1", nameEn: "Yasmine Kamal", nameAr: "ياسمين كمال", roleEn: "Senior Sales", roleAr: "مبيعات أولى", online: true },
    { id: "emp_2", nameEn: "Ahmed Sobhy", nameAr: "أحمد صبحي", roleEn: "Catalog & Listings", roleAr: "الكتالوج والقوائم", online: true },
    { id: "emp_3", nameEn: "Mona Farid", nameAr: "منى فريد", roleEn: "Customer Care", roleAr: "خدمة العملاء", online: false },
    { id: "emp_4", nameEn: "Tarek Adel", nameAr: "طارق عادل", roleEn: "Dispatch & Packing", roleAr: "الشحن والتغليف", online: true },
    { id: "emp_5", nameEn: "Salma Nabil", nameAr: "سلمى نبيل", roleEn: "Content & Photography", roleAr: "المحتوى والتصوير", online: false },
  ];

  const t = (
    id: string, employeeId: string, kind: Database["tasks"][number]["kind"],
    titleEn: string, titleAr: string, status: TaskStatus,
    dueDays: number, updatedDays: number, priority: "normal" | "high" = "normal",
  ): Database["tasks"][number] => ({
    id, employeeId, kind, titleEn, titleAr, status, priority,
    dueAt: iso(dueDays), updatedAt: iso(updatedDays),
  });

  const tasks: Database["tasks"] = [
    t("tsk_1", "emp_3", "enquiry", "Follow up Nour Hassan — villa order quote", "متابعة نور حسن — عرض سعر طلب الفيلا", "todo", -1, -2, "high"),
    t("tsk_2", "emp_3", "followup", "Call Karim Fouad about 40-piece wholesale order", "الاتصال بكريم فؤاد بخصوص طلب جملة ٤٠ قطعة", "todo", 0, -3, "high"),
    t("tsk_3", "emp_2", "listing", "Publish 6 mother-of-pearl trays with new photos", "نشر ٦ صواني صدف بصور جديدة", "in-progress", -2, -1),
    t("tsk_4", "emp_2", "listing", "Fix Noon catalog: 7 SKUs missing dimensions", "تصحيح كتالوج نون: ٧ منتجات بلا أبعاد", "todo", -1, -4, "high"),
    t("tsk_5", "emp_1", "enquiry", "Quote Hala Mostafa — 180cm aquarium sketch", "عرض سعر هالة مصطفى — رسم حوض ١٨٠ سم", "in-progress", 1, 0, "high"),
    t("tsk_6", "emp_1", "followup", "Prepare wedding season glassware bundle offer", "تجهيز عرض باقة زجاج لموسم الأفراح", "review", 2, 0),
    t("tsk_7", "emp_4", "dispatch", "Pack chandelier for New Cairo delivery", "تغليف النجفة لتوصيل القاهرة الجديدة", "todo", 1, 0, "high"),
    t("tsk_8", "emp_4", "dispatch", "Reorder double-wall boxes for perfume bottles", "إعادة طلب كراتين مزدوجة لزجاجات العطر", "in-progress", 3, -1),
    t("tsk_9", "emp_5", "content", "Shoot pearl backgammon board on dark backdrop", "تصوير طاولة السيجة على خلفية داكنة", "done", -3, -3),
    t("tsk_10", "emp_5", "content", "Write bilingual captions for 12 glass pendants", "كتابة تعليقات ثنائية اللغة لـ ١٢ معلق زجاجي", "todo", 0, -5),
    t("tsk_11", "emp_2", "listing", "Update glass tea set price after furnace cost rise", "تحديث سعر طقم الشاي بعد ارتفاع تكلفة الفرن", "done", -2, -2),
    t("tsk_12", "emp_3", "followup", "Answer 3-star Noon review about packaging", "الرد على تقييم نون ٣ نجوم عن التغليف", "todo", -2, -2, "high"),
  ];

  const activity: Database["activity"] = [
    { id: "act_1", at: iso(0, -1), actor: "ai", tone: "good", textEn: "Qualified a wholesale enquiry from Karim Fouad — 40 perfume bottles.", textAr: "تأهيل استفسار جملة من كريم فؤاد — ٤٠ زجاجة عطر." },
    { id: "act_2", at: iso(0, -2), actor: "ai", tone: "warn", textEn: "Noon returns reached 29% — flagged for review.", textAr: "مرتجعات نون وصلت ٢٩٪ — تم تنبيه الفريق للمراجعة." },
    { id: "act_3", at: iso(0, -5), actor: "emp_1", tone: "neutral", textEn: "Yasmine took over the aquarium enquiry from the AI desk.", textAr: "ياسمين استلمت استفسار الحوض من مكتب الذكاء الاصطناعي." },
    { id: "act_4", at: iso(-1, -2), actor: "ai", tone: "good", textEn: "Nour Hassan's villa enquiry is ready for a human quote.", textAr: "استفسار فيلا نور حسن جاهز لعرض سعر بشري." },
    { id: "act_5", at: iso(-1, -6), actor: "emp_2", tone: "neutral", textEn: "Ahmed published 6 pearl trays to the website.", textAr: "أحمد نشر ٦ صواني صدف على الموقع." },
    { id: "act_6", at: iso(-2, -3), actor: "ai", tone: "warn", textEn: "Two dispatch tasks are past their due date.", textAr: "مهمتان في الشحن تجاوزتا موعد التسليم." },
  ];

  const line = (key: string, labelEn: string, labelAr: string, valueEn: string, valueAr: string): Database["orders"][number]["lines"][number] => ({
    key, labelEn, labelAr, valueEn, valueAr,
  });

  /* Order sheets the agents already closed, kept as the team's record. */
  const orders: Database["orders"] = [
    {
      id: "ord_1", ref: "CA-2026-1001", conversationId: null,
      customerName: "Nour Hassan", phone: "+20 111 876 3300", channel: "website", lang: "en",
      productEn: "Chandeliers", productAr: "النجف", quantity: 1, budgetEgp: 32_000, city: "New Cairo",
      lines: [
        line("product", "The piece", "القطعة", "Chandeliers", "النجف"),
        line("quantity", "Quantity", "الكمية", "1 pcs", "1 قطعة"),
        line("variant", "Finish / size", "اللون / المقاس", "gold finish", "لمسة ذهبية"),
        line("personalization", "Personalisation", "التخصيص", "no personalisation", "بدون تخصيص"),
        line("city", "Delivery city", "مدينة التوصيل", "New Cairo", "New Cairo"),
        line("timeline", "Needed by", "ميعاد الاستلام", "next month", "الشهر الجاي"),
        line("budget", "Budget", "الميزانية", "32,000 EGP", "32,000 ج.م"),
        line("payment", "Payment", "الدفع", "deposit", "مقدم"),
        line("confirm", "Customer confirmed", "تأكيد العميل", "confirmed by the customer", "مؤكد من العميل"),
      ],
      openDetails: [], agent: "closing", status: "production", assignedTo: "emp_1",
      confirmedAt: iso(-6, -2), updatedAt: iso(-2),
    },
    {
      id: "ord_2", ref: "CA-2026-1002", conversationId: null,
      customerName: "Karim Fouad", phone: "+20 122 005 7714", channel: "whatsapp", lang: "en",
      productEn: "Perfume oil bottles", productAr: "زجاجات العطر", quantity: 40, budgetEgp: 18_000, city: "Zamalek, Cairo",
      lines: [
        line("product", "The piece", "القطعة", "Perfume oil bottles", "زجاجات العطر"),
        line("quantity", "Quantity", "الكمية", "40 pcs", "40 قطعة"),
        line("variant", "Finish / size", "اللون / المقاس", "clear glass", "زجاج شفاف"),
        line("personalization", "Personalisation", "التخصيص", "logo engraved", "نقش الشعار"),
        line("city", "Delivery city", "مدينة التوصيل", "Zamalek, Cairo", "Zamalek, Cairo"),
        line("timeline", "Needed by", "ميعاد الاستلام", "this week", "الأسبوع ده"),
        line("budget", "Budget", "الميزانية", "18,000 EGP", "18,000 ج.م"),
        line("payment", "Payment", "الدفع", "bank transfer", "تحويل بنكي"),
        line("confirm", "Customer confirmed", "تأكيد العميل", "confirmed by the customer", "مؤكد من العميل"),
      ],
      openDetails: [], agent: "closing", status: "shipped", assignedTo: "emp_3",
      confirmedAt: iso(-4, -5), updatedAt: iso(-1),
    },
    {
      id: "ord_3", ref: "CA-2026-1003", conversationId: null,
      customerName: "Mariam Adel", phone: "+20 100 442 8891", channel: "whatsapp", lang: "ar",
      productEn: "Tea sets", productAr: "أطقم الشاي", quantity: 6, budgetEgp: 4_850, city: "المعادي",
      lines: [
        line("product", "The piece", "القطعة", "Tea sets", "أطقم الشاي"),
        line("quantity", "Quantity", "الكمية", "6 pcs", "6 قطعة"),
        line("variant", "Finish / size", "اللون / المقاس", "amber glass", "زجاج عنبري"),
        line("personalization", "Personalisation", "التخصيص", "name engraved", "نقش الاسم"),
        line("city", "Delivery city", "مدينة التوصيل", "المعادي", "المعادي"),
        line("timeline", "Needed by", "ميعاد الاستلام", "next week", "الأسبوع الجاي"),
        line("budget", "Budget", "الميزانية", "4,850 EGP", "4,850 ج.م"),
        line("payment", "Payment", "الدفع", "cash on delivery", "الدفع عند الاستلام"),
        line("confirm", "Customer confirmed", "تأكيد العميل", "confirmed by the customer", "مؤكد من العميل"),
      ],
      openDetails: [], agent: "closing", status: "delivered", assignedTo: "emp_1",
      confirmedAt: iso(-11, -4), updatedAt: iso(-3),
    },
    {
      id: "ord_4", ref: "CA-2026-1004", conversationId: null,
      customerName: "Layla Hany", phone: "@laylahany", channel: "instagram", lang: "en",
      productEn: "Jewelry boxes", productAr: "علب المجوهرات", quantity: 1, budgetEgp: 2_500, city: "Heliopolis",
      lines: [
        line("product", "The piece", "القطعة", "Jewelry boxes", "علب المجوهرات"),
        line("quantity", "Quantity", "الكمية", "1 pcs", "1 قطعة"),
        line("variant", "Finish / size", "اللون / المقاس", "navy inlay", "صدف على كحلي"),
        line("personalization", "Personalisation", "التخصيص", "gift wrap", "تغليف هدية"),
        line("city", "Delivery city", "مدينة التوصيل", "Heliopolis", "Heliopolis"),
        line("budget", "Budget", "الميزانية", "2,500 EGP", "2,500 ج.م"),
        line("payment", "Payment", "الدفع", "InstaPay", "إنستاباي"),
        line("confirm", "Customer confirmed", "تأكيد العميل", "confirmed by the customer", "مؤكد من العميل"),
      ],
      openDetails: ["timeline"], agent: "closing", status: "new", assignedTo: null,
      confirmedAt: iso(0, -1), updatedAt: iso(0, -1),
    },
  ];

  /* WhatsApp numbers kept by hand, one discount coupon per group. */
  const groups: Database["groups"] = [
    {
      id: "grp_1", nameEn: "Regulars", nameAr: "العملاء الدائمون", discountPct: 15, couponCode: "CAIRO15",
      createdAt: iso(-40), lastSentAt: iso(-12),
      contacts: [
        { id: "ctc_1", name: "Mariam Adel", phone: "+20 100 442 8891", addedAt: iso(-40), lastSentAt: iso(-12) },
        { id: "ctc_2", name: "Hala Mostafa", phone: "+20 100 771 6655", addedAt: iso(-38), lastSentAt: iso(-12) },
        { id: "ctc_3", name: "Dina Samir", phone: "+20 128 339 0022", addedAt: iso(-30), lastSentAt: iso(-12) },
      ],
    },
    {
      id: "grp_2", nameEn: "Wholesale buyers", nameAr: "عملاء الجملة", discountPct: 25, couponCode: "CAIRO25",
      createdAt: iso(-25),
      contacts: [
        { id: "ctc_4", name: "Karim Fouad", phone: "+20 122 005 7714", addedAt: iso(-25) },
        { id: "ctc_5", name: "Nour El Din", phone: "+20 109 553 1188", addedAt: iso(-20) },
      ],
    },
    {
      id: "grp_3", nameEn: "Wedding season", nameAr: "موسم الأفراح", discountPct: 10, couponCode: "WEDDING10",
      createdAt: iso(-10),
      contacts: [
        { id: "ctc_6", name: "Nour Hassan", phone: "+20 111 876 3300", addedAt: iso(-10) },
        { id: "ctc_7", name: "Layla Hany", phone: "+20 106 220 4477", addedAt: iso(-8) },
      ],
    },
  ];

  const db: Database = { products, conversations, orders, channels, employees, tasks, activity, groups };
  for (const conv of db.conversations) {
    conv.qualification = {
      intent: "unqualified", interests: [], quantity: null, budgetEgp: null, city: null, timeline: null,
      missing: ["interest", "quantity", "city"], score: 0,
      summaryEn: "Awaiting qualification.", summaryAr: "في انتظار التأهيل.",
    };
  }
  return db;
}

function emptyQual() {
  return {
    intent: "unqualified", interests: [], quantity: null, budgetEgp: null, city: null, timeline: null,
    missing: ["interest", "quantity", "city"], score: 0,
    summaryEn: "Awaiting qualification.", summaryAr: "في انتظار التأهيل.",
  };
}
