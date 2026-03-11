-- マイグレーション: budgets.year_month を fiscal_year (integer) に変更
-- ★ Neon コンソールで実行してください

-- 1. 新しいカラムを追加
ALTER TABLE budgets ADD COLUMN fiscal_year integer;

-- 2. 既存データを移行（year_month の年部分を fiscal_year に設定）
UPDATE budgets SET fiscal_year = CAST(SPLIT_PART(year_month, '-', 1) AS integer);

-- 3. 重複データを削除（同一 company + account + year が複数ある場合、最初の1件だけ残す）
DELETE FROM budgets a
USING budgets b
WHERE a.id > b.id
  AND a.company_id = b.company_id
  AND a.account_item_id = b.account_item_id
  AND a.fiscal_year = b.fiscal_year;

-- 4. NOT NULL 制約を付与
ALTER TABLE budgets ALTER COLUMN fiscal_year SET NOT NULL;

-- 5. 古いユニーク制約を削除
ALTER TABLE budgets DROP CONSTRAINT IF EXISTS budgets_company_account_month_unique;

-- 6. 古いカラムを削除
ALTER TABLE budgets DROP COLUMN year_month;

-- 7. 新しいユニーク制約を追加
ALTER TABLE budgets ADD CONSTRAINT budgets_company_account_year_unique
  UNIQUE (company_id, account_item_id, fiscal_year);
