-- 初期マイグレーション: 全テーブルを作成

-- NextAuth.js 用テーブル
CREATE TABLE IF NOT EXISTS "auth_users" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY NOT NULL,
  "name" varchar(255),
  "email" varchar(255) NOT NULL UNIQUE,
  "email_verified" timestamp,
  "image" text
);

CREATE TABLE IF NOT EXISTS "accounts" (
  "user_id" uuid NOT NULL REFERENCES "auth_users"("id") ON DELETE CASCADE,
  "type" varchar(255) NOT NULL,
  "provider" varchar(255) NOT NULL,
  "provider_account_id" varchar(255) NOT NULL,
  "refresh_token" text,
  "access_token" text,
  "expires_at" integer,
  "token_type" varchar(255),
  "scope" varchar(255),
  "id_token" text,
  "session_state" varchar(255),
  PRIMARY KEY ("provider", "provider_account_id")
);

CREATE TABLE IF NOT EXISTS "sessions" (
  "session_token" varchar(255) PRIMARY KEY NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "auth_users"("id") ON DELETE CASCADE,
  "expires" timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS "verification_tokens" (
  "identifier" varchar(255) NOT NULL,
  "token" varchar(255) NOT NULL,
  "expires" timestamp NOT NULL,
  PRIMARY KEY ("identifier", "token")
);

-- アプリ用マスターテーブル
CREATE TABLE IF NOT EXISTS "companies" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY NOT NULL,
  "name" varchar(255) NOT NULL,
  "code" varchar(5) NOT NULL UNIQUE,
  "fiscal_year_end_month" smallint NOT NULL DEFAULT 12,
  "drive_parent_folder_id" varchar(255),
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "account_items" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY NOT NULL,
  "name" varchar(255) NOT NULL,
  "yayoi_name" varchar(255),
  "tax_category" varchar(20) NOT NULL DEFAULT 'taxable',
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY NOT NULL,
  "email" varchar(255) NOT NULL UNIQUE,
  "display_name" varchar(255) NOT NULL,
  "image" text,
  "bank_name" varchar(255),
  "bank_branch" varchar(255),
  "account_number" varchar(50),
  "account_holder" varchar(255),
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

-- 領収書テーブル
CREATE TABLE IF NOT EXISTS "receipts" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY NOT NULL,
  "receipt_no" varchar(20) UNIQUE,
  "settlement_month" char(7) NOT NULL,
  "account_item_id" uuid NOT NULL REFERENCES "account_items"("id"),
  "receipt_date" date,
  "amount" integer NOT NULL,
  "store_name" varchar(255),
  "purpose" text,
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "file_name" varchar(500),
  "drive_file_id" varchar(255),
  "drive_url" text,
  "has_invoice" boolean NOT NULL DEFAULT false,
  "invoice_number" varchar(50),
  "claimant_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "settlement_status" varchar(20) NOT NULL DEFAULT 'unsettled',
  "settlement_date" date,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "created_by" uuid NOT NULL REFERENCES "users"("id")
);

-- 予算テーブル
CREATE TABLE IF NOT EXISTS "budgets" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "account_item_id" uuid NOT NULL REFERENCES "account_items"("id"),
  "year_month" char(7) NOT NULL,
  "amount" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "budgets_company_account_month_unique" UNIQUE ("company_id", "account_item_id", "year_month")
);

-- 採番管理テーブル
CREATE TABLE IF NOT EXISTS "receipt_sequences" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "fiscal_year" integer NOT NULL,
  "last_number" integer NOT NULL DEFAULT 0
);

-- インデックス
CREATE INDEX IF NOT EXISTS "receipts_settlement_month_idx" ON "receipts" ("settlement_month");
CREATE INDEX IF NOT EXISTS "receipts_company_id_idx" ON "receipts" ("company_id");
CREATE INDEX IF NOT EXISTS "receipts_claimant_user_id_idx" ON "receipts" ("claimant_user_id");
CREATE INDEX IF NOT EXISTS "receipts_settlement_status_idx" ON "receipts" ("settlement_status");
CREATE INDEX IF NOT EXISTS "budgets_year_month_idx" ON "budgets" ("year_month");

-- サンプルデータ（初期セットアップ用）
INSERT INTO "account_items" ("name", "yayoi_name", "tax_category", "sort_order") VALUES
  ('旅費交通費', '旅費交通費', 'taxable', 10),
  ('接待交際費', '接待交際費', 'taxable', 20),
  ('消耗品費', '消耗品費', 'taxable', 30),
  ('通信費', '通信費', 'taxable', 40),
  ('会議費', '会議費', 'taxable', 50),
  ('福利厚生費', '福利厚生費', 'taxable', 60),
  ('新聞図書費', '新聞図書費', 'taxable', 70),
  ('雑費', '雑費', 'taxable', 80)
ON CONFLICT DO NOTHING;
