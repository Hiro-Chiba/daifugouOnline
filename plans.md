# 実装計画

1. プロジェクトセットアップ
   - Next.js 14(App Router) + TypeScript の基本構成を生成し、`package.json`、`tsconfig.json`、`next.config.mjs` などを整備する。
   - ESLint と Prettier の設定を追加し、厳格な TypeScript 設定を適用する。
   - `.env.example` を用意して環境変数を一覧化する。

2. Prisma/データアクセス整備
   - `prisma/schema.prisma` を要件通りに定義し、Prisma 設定ファイルと `src/lib/db.ts` を作成する。
   - Neon(PostgreSQL) を想定した設定を記述し、Prisma クライアント生成ユーティリティを実装する。

3. リアルタイム通信設定
   - Pusher のサーバー/クライアントユーティリティ (`src/lib/pusher-server.ts`, `src/lib/pusher-client.ts`) を実装する。
   - API 認可エンドポイント `/api/pusher-auth` を作成し、Presence チャンネルに対応させる。

4. ゲームエンジン
   - `src/lib/game` 配下に型定義、デッキ生成/配布、検証、エンジン処理を実装する。
   - 特殊効果やターン処理、公開情報変換などのロジックを組み込む。

5. API ルート
   - ルーム作成/参加、プレイ、パス、同期の各 API を実装し、Prisma とゲームエンジンを統合する。
   - 状態更新時に Pusher イベントを送出する実装を行う。

6. フロントエンド UI
   - トップページ、ルームページ、各コンポーネントを作成する。
   - スマホ向けレスポンシブデザインを意識したスタイルと日本語 UI を実装する。
   - Pusher クライアントでリアルタイム更新を購読し、ゲーム状態を描画する。

7. 付帯ファイル
   - README.md を日本語で更新し、セットアップ/起動手順を記載する。
   - 必要な補助ファイル（`globals.css` 等）を整備してビルド可能な状態にする。

