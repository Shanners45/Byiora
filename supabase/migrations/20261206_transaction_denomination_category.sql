-- Orders keep the pack's category name as it was at checkout (like a Shopify line item's variant
-- title), so two packs that share a title (Valorant "475 VP" Nepal / India) read apart in admin,
-- alerts and emails even after the product's categories are renamed or removed.
alter table public.transactions add column if not exists denomination_category text;

-- Existing orders: take the category from the product as it is now. Flag emoji are dropped.
update public.transactions t
set denomination_category = nullif(btrim(regexp_replace(c->>'name', '[\U0001F1E6-\U0001F1FF]', '', 'g')), '')
from public.products p,
     jsonb_array_elements(case when jsonb_typeof(p.denominations) = 'array' then p.denominations else '[]'::jsonb end) d,
     jsonb_array_elements(case when jsonb_typeof(p.denomination_categories) = 'array' then p.denomination_categories else '[]'::jsonb end) c
where t.product_id = p.id
  and t.denomination_id is not null
  and t.denomination_category is null
  and d->>'id' = t.denomination_id
  and c->>'id' = d->>'categoryId';
