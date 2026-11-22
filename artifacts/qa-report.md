# Cairo Art — live acceptance run

2026-11-22T14:26:26.156Z

**103/103 checks passed.**

No failures.


## Arabic customer conversation — what the bot actually said


**First Arabic message**

> السلام عليكم، عايزة أستفسر عن الفازات

تمام، سجلت: الفازات. الكمية قد إيه؟ قطعة واحدة، طقم، ولا كمية جملة لمحل؟

`sheet: empty · agent: intake · ai-handling`

**Arabic turn 2**

> عايزة ٣ قطع

تمام، سجلت: ٣ قطع. اللون والمقاس؟ الزجاج عندنا شفاف أو عنبري أو دخاني أو أزرق أو أخضر، والصدف على جوز أو أسود أو كحلي — وأقدر آخذ المقاس بالسنتيمتر.

`sheet: product=vases · quantity=3 · agent: spec · ai-handling`

**Arabic turn 3**

> شفاف ومقاس كبير

تمام، سجلت: زجاج شفاف. تحب نخصصها — اسم، حروف، أو شعار محلك؟ ولو مش عايز، قول "بدون" وعادي جدًا.

`sheet: product=vases · quantity=3 · variant=clear · agent: spec · ai-handling`

**Arabic turn 4**

> أيوه عايزة نقش اسم منى

تمام، سجلت: نقش الاسم. التوصيل لمين وإيه؟ أنهي مدينة ومنطقة؟

`sheet: product=vases · quantity=3 · variant=clear · personalization=engraved · agent: delivery · ai-handling`

**Arabic turn 5**

> التوصيل في المعادي

تمام، سجلت: المعادي. محتاجه يوصلك إمتى؟ قطع مثل النجف والطاولات المطعمة صدف تاخد من ٤ لـ ٦ أسابيع.

`sheet: product=vases · quantity=3 · variant=clear · personalization=engraved · city=Maadi · agent: delivery · ai-handling`

**Arabic turn 6**

> عندي فرح آخر الشهر

تمام، سجلت: تاريخ الفرح. والميزانية — للقطعة ولا للطلب كله — عشان المختص يسعّر صح؟

`sheet: product=vases · quantity=3 · variant=clear · personalization=engraved · city=Maadi · timeline=wedding date · agent: pricing · ai-handling`

**Arabic turn 7**

> الميزانية ٣٠٠٠ جنيه

تمام، سجلت: ٣٬٠٠٠ ج.م. الدفع إزاي — عند الاستلام، إنستاباي، ولا تحويل بنكي؟

`sheet: product=vases · quantity=3 · variant=clear · personalization=engraved · city=Maadi · timeline=wedding date · budget=3000 · agent: closing · ai-handling`

**Arabic turn 8**

> هحول إنستاباي

تمام، سجلت: إنستاباي. القطعة: الفازات
> الكمية: ٣ قطع
> اللون / المقاس: زجاج شفاف
> التخصيص: نقش الاسم
> مدينة التوصيل: المعادي
> ميعاد الاستلام: تاريخ الفرح
> الميزانية: ٣٬٠٠٠ ج.م
> الدفع: إنستاباي
> 
> الطلب كامل عندي — أثبّت التفاصيل وأحوّلك لمختص من Cairo Art؟

`sheet: product=vases · quantity=3 · variant=clear · personalization=engraved · city=Maadi · timeline=wedding date · budget=3000 · payment=instapay · agent: closing · ai-handling`

**Arabic turn 9**

> تمام، أكد الطلب

الطلب كامل ✅
> 
> القطعة: الفازات
> الكمية: ٣ قطع
> اللون / المقاس: زجاج شفاف
> التخصيص: نقش الاسم
> مدينة التوصيل: المعادي
> ميعاد الاستلام: تاريخ الفرح
> الميزانية: ٣٬٠٠٠ ج.م
> الدفع: إنستاباي
> تأكيد العميل: مؤكد من العميل
> 
> بحوّلك لمختص من Cairo Art لتأكيد السعر النهائي والدفع والتسليم.

`sheet: product=vases · quantity=3 · variant=clear · personalization=engraved · city=Maadi · timeline=wedding date · budget=3000 · payment=instapay · confirm=yes · agent: closing · ready-for-handoff`

## English wholesale conversation — what the bot actually said


**English turn 1**

> I need 30 pieces for my gift shop

Noted: 30 pcs. Which finish and size? Glass comes in clear, amber, smoke, blue or green; pearl inlay sits on walnut, black or navy — and I can take an exact size in cm.

`sheet: product=backgammon · quantity=30 · city=Alexandria · agent: spec · ai-handling`

**English turn 2**

> Walnut with black inlay, medium size

Noted: walnut inlay. Would you like it personalised — a name, initials or your shop's logo? A plain 'no' is completely fine.

`sheet: product=backgammon · quantity=30 · variant=walnut · city=Alexandria · agent: spec · ai-handling`

**English turn 3**

> Yes, engrave our shop logo

Noted: logo engraved. When do you need it in hand? Made-to-order pieces such as chandeliers and inlay tables take four to six weeks.

`sheet: product=backgammon · quantity=30 · variant=walnut · personalization=logo · city=Alexandria · agent: delivery · ai-handling`

**English turn 4**

> Alexandria, Sidi Gaber

When do you need it in hand? Made-to-order pieces such as chandeliers and inlay tables take four to six weeks.

`sheet: product=backgammon · quantity=30 · variant=walnut · personalization=logo · city=Alexandria · agent: delivery · ai-handling`

**English turn 5**

> I need them next week

Noted: next week. And the budget — per piece or for the whole order — so the specialist prices it correctly?

`sheet: product=backgammon · quantity=30 · variant=walnut · personalization=logo · city=Alexandria · timeline=next week · agent: pricing · ai-handling`

**English turn 6**

> Budget is 45,000 EGP for the lot

Noted: 45,000 EGP. How would you like to pay — cash on delivery, InstaPay, or a bank transfer?

`sheet: product=backgammon · quantity=30 · variant=walnut · personalization=logo · city=Alexandria · timeline=next week · budget=45000 · agent: closing · ai-handling`

**English turn 7**

> Bank transfer

Noted: bank transfer. The piece: backgammon boards
> Quantity: 30 pcs
> Finish / size: walnut inlay
> Personalisation: logo engraved
> Delivery city: Alexandria
> Needed by: next week
> Budget: 45,000 EGP
> Payment: bank transfer
> 
> I have the full order sheet — shall I lock these details and pass you to a Cairo Art specialist?

`sheet: product=backgammon · quantity=30 · variant=walnut · personalization=logo · city=Alexandria · timeline=next week · budget=45000 · payment=transfer · agent: closing · ai-handling`

**English turn 8**

> Yes, confirmed

The order sheet is complete ✅
> 
> The piece: backgammon boards
> Quantity: 30 pcs
> Finish / size: walnut inlay
> Personalisation: logo engraved
> Delivery city: Alexandria
> Needed by: next week
> Budget: 45,000 EGP
> Payment: bank transfer
> Customer confirmed: confirmed by the customer
> 
> Passing you to a Cairo Art specialist to confirm the final price, payment and delivery.

`sheet: product=backgammon · quantity=30 · variant=walnut · personalization=logo · city=Alexandria · timeline=next week · budget=45000 · payment=transfer · confirm=yes · agent: closing · ready-for-handoff`

## Sales feedback shown to the boss

**EN** 618,800 EGP across 207 orders this month. cairoart.com carries 30% of revenue, while Facebook is down 6%.

**AR** 618,800 ج.م من 207 طلب هذا الشهر. cairoart.com تمثل 30٪ من الإيراد، بينما فيسبوك تراجعت 6٪.

- TikTok Shop converts only 0.2% of 21,500 visits — traffic is arriving without buying.
- Instagram recorded 4 returns, the highest of any channel, and is flat.

**Actions**
1. Move 25% of Instagram ad spend into TikTok Shop for two weeks and watch cost per order.
   حوّل ٢٥٪ من ميزانية إعلانات إنستجرام إلى تيك توك شوب لأسبوعين وراقب تكلفة الطلب.
1. Have the catalog owner audit TikTok Shop listings: dimensions, lead time and shipping cost on every SKU.
   كلّف مسؤول الكتالوج بمراجعة قوائم تيك توك شوب: الأبعاد ومدة التنفيذ والشحن لكل منتج.
1. Push the pearl backgammon and chess boards into Instagram — highest ticket, strongest gifting demand.
   روّج طاولات السيجة والشطرنج الصدف على إنستجرام — أعلى سعر وأقوى طلب للمناسبات.
