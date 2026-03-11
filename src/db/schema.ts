import {
  pgTable,
  uuid,
  varchar,
  char,
  text,
  integer,
  smallint,
  boolean,
  date,
  timestamp,
  primaryKey,
  unique,
} from "drizzle-orm/pg-core";

// ─────────────────────────────────────────────
// companies テーブル
// ─────────────────────────────────────────────
export const companies = pgTable("companies", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 5 }).notNull().unique(),
  fiscalYearEndMonth: smallint("fiscal_year_end_month").notNull().default(12),
  driveParentFolderId: varchar("drive_parent_folder_id", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─────────────────────────────────────────────
// account_items テーブル（勘定科目）
// ─────────────────────────────────────────────
export const accountItems = pgTable("account_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  yayoiName: varchar("yayoi_name", { length: 255 }), // 弥生会計での科目名
  taxCategory: varchar("tax_category", { length: 20 }).notNull().default("taxable"), // 'taxable' | 'exempt'
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─────────────────────────────────────────────
// users テーブル
// ─────────────────────────────────────────────
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  displayName: varchar("display_name", { length: 255 }).notNull(),
  image: text("image"),
  bankName: varchar("bank_name", { length: 255 }),
  bankBranch: varchar("bank_branch", { length: 255 }),
  accountNumber: varchar("account_number", { length: 50 }),
  accountHolder: varchar("account_holder", { length: 255 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─────────────────────────────────────────────
// NextAuth.js v5 用テーブル（Drizzle Adapter）
// ─────────────────────────────────────────────
export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 255 }).notNull(),
    provider: varchar("provider", { length: 255 }).notNull(),
    providerAccountId: varchar("provider_account_id", { length: 255 }).notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: varchar("token_type", { length: 255 }),
    scope: varchar("scope", { length: 255 }),
    id_token: text("id_token"),
    session_state: varchar("session_state", { length: 255 }),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  })
);

export const sessions = pgTable("sessions", {
  sessionToken: varchar("session_token", { length: 255 }).notNull().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const authUsers = pgTable("auth_users", {
  id: uuid("id").defaultRandom().notNull().primaryKey(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: varchar("identifier", { length: 255 }).notNull(),
    token: varchar("token", { length: 255 }).notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  })
);

// ─────────────────────────────────────────────
// receipts テーブル
// ─────────────────────────────────────────────
export const receipts = pgTable("receipts", {
  id: uuid("id").defaultRandom().primaryKey(),
  receiptNo: varchar("receipt_no", { length: 20 }).unique(),
  settlementMonth: char("settlement_month", { length: 7 }).notNull(), // YYYY-MM
  accountItemId: uuid("account_item_id")
    .notNull()
    .references(() => accountItems.id),
  receiptDate: date("receipt_date"),
  amount: integer("amount").notNull(),
  storeName: varchar("store_name", { length: 255 }),
  purpose: text("purpose"),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id),
  fileName: varchar("file_name", { length: 500 }),
  driveFileId: varchar("drive_file_id", { length: 255 }),
  driveUrl: text("drive_url"),
  hasInvoice: boolean("has_invoice").notNull().default(false),
  invoiceNumber: varchar("invoice_number", { length: 50 }),
  claimantUserId: uuid("claimant_user_id")
    .notNull()
    .references(() => users.id),
  settlementStatus: varchar("settlement_status", { length: 20 })
    .notNull()
    .default("unsettled"), // 'unsettled' | 'settled'
  settlementDate: date("settlement_date"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
});

// ─────────────────────────────────────────────
// budgets テーブル
// ─────────────────────────────────────────────
export const budgets = pgTable(
  "budgets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    accountItemId: uuid("account_item_id")
      .notNull()
      .references(() => accountItems.id),
    fiscalYear: integer("fiscal_year").notNull(), // 会計年度 (例: 2025)
    amount: integer("amount").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    uniqueBudget: unique("budgets_company_account_year_unique").on(
      table.companyId,
      table.accountItemId,
      table.fiscalYear
    ),
  })
);

// ─────────────────────────────────────────────
// receipt_sequences テーブル（採番管理）
// ─────────────────────────────────────────────
export const receiptSequences = pgTable("receipt_sequences", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id),
  fiscalYear: integer("fiscal_year").notNull(),
  lastNumber: integer("last_number").notNull().default(0),
});

// ─────────────────────────────────────────────
// 型定義エクスポート
// ─────────────────────────────────────────────
export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
export type AccountItem = typeof accountItems.$inferSelect;
export type NewAccountItem = typeof accountItems.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Receipt = typeof receipts.$inferSelect;
export type NewReceipt = typeof receipts.$inferInsert;
export type Budget = typeof budgets.$inferSelect;
export type NewBudget = typeof budgets.$inferInsert;
