# 経費精算・予算管理システム

Gemini API による OCR を活用した、複数会社対応の経費精算・予算管理 Web アプリケーションです。

## 技術スタック

| 技術 | 用途 |
|---|---|
| Next.js 15 (App Router) | フロント + バックエンド |
| NextAuth.js v5 | Google OAuth 認証 |
| Neon (PostgreSQL) | データベース |
| Drizzle ORM | DB アクセス |
| Gemini 1.5 Flash | OCR・領収書解析 |
| Google Drive API | ファイル保存 |
| Vercel | ホスティング |
| Tailwind CSS | スタイリング |
| Recharts | グラフ |

## 機能一覧

- **Google ログイン** - ドメイン制限対応
- **OCR 登録（単票）** - 領収書を撮影/アップロード → Gemini で自動解析 → 確認・修正 → 保存
- **OCR 登録（一括）** - 複数枚を一括アップロード・順次解析・一括保存
- **領収書一覧** - 絞り込み・検索・削除
- **精算管理** - 精算者別に振込リストを表示・振込済ステータス管理
- **予算管理** - 会社別・勘定科目別の月次予算設定・実績グラフ
- **CSV 出力** - 弥生会計インポート形式 / 汎用 CSV
- **マスター設定** - 会社・勘定科目・ユーザー・口座情報の管理
- **ダッシュボード** - 今月経費合計・予算消化率グラフ

## セットアップ

### 1. 環境変数の設定

`.env.local` を作成し以下を設定：

```env
# Neon PostgreSQL
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require

# NextAuth.js
AUTH_SECRET=（openssl rand -base64 32 で生成）
AUTH_GOOGLE_ID=Google Cloud Console で取得
AUTH_GOOGLE_SECRET=Google Cloud Console で取得

# 許可するメールドメイン
ALLOWED_EMAIL_DOMAIN=example.com

# Gemini API
GEMINI_API_KEY=Google AI Studio で取得

# Google Drive サービスアカウント（JSON を1行で）
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
```

### 2. データベースのセットアップ

Neon コンソールで `drizzle/0000_initial.sql` を実行してください。

### 3. Google OAuth の設定

Google Cloud Console で:
1. OAuth 2.0 クライアント ID を作成
2. 承認済みリダイレクト URI に `https://your-domain.com/api/auth/callback/google` を追加

### 4. Google Drive の設定

1. Google Cloud Console でサービスアカウントを作成
2. Drive API を有効化
3. 会社の共有ドライブにサービスアカウントのメールを共有
4. マスター設定で Drive フォルダ ID を設定

### 5. 起動

```bash
npm install
npm run dev
```

## Vercel へのデプロイ

```bash
vercel --prod
```

Vercel Dashboard で `.env.local` の内容を環境変数として設定してください。

## 領収書 No 採番ルール

形式: `{会社コード}-{会計年度}-{4桁連番}`
例: `A-2025-0001`

## CSV 出力（弥生会計）

弥生会計インストール版の「仕訳日記帳」CSV インポート形式に対応。インボイス有無により税区分を自動切替：

- インボイスあり → `課税仕入10%`
- インボイスなし → `課税仕入10%(80%)` （2026年9月まで経過措置）
