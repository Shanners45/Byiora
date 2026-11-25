-- Finishes 20261204_denomination_ids: merchant price rules and merchant SKUs are unique per pack id,
-- no longer per title, so two packs that share a title (Valorant Nepal / India "475 VP") can each
-- have their own merchant price and SKU.

-- Product-wide rules use the empty pack id; every other rule has its pack's id.
update public.merchant_price_rules set denomination_id = '' where denomination_id is null and denomination_label = '';
delete from public.merchant_price_rules where denomination_id is null; -- rules for packs that no longer exist
alter table public.merchant_price_rules alter column denomination_id set not null;
alter table public.merchant_price_rules drop constraint if exists merchant_price_rules_pkey;
drop index if exists public.merchant_price_rules_merchant_product_denomination_id_key;
alter table public.merchant_price_rules add constraint merchant_price_rules_pkey primary key (merchant_id, product_id, denomination_id);

alter table public.merchant_skus drop constraint if exists merchant_skus_merchant_id_product_id_denomination_label_key;
