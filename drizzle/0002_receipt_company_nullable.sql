-- マイグレーション: receipts.company_id を nullable に変更
-- ★ Neon コンソールで実行してください

ALTER TABLE receipts ALTER COLUMN company_id DROP NOT NULL;
