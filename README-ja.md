# 大富豪オンライン MVP

Next.js 14・Pusher・Neon(PostgreSQL)・Prisma を用いたリアルタイム大富豪アプリです。Vercel デプロイとローカル開発の双方を想定した構成になっています。

## 必要要件

- Node.js 18 以上
- npm 9 以上
- PostgreSQL（Neon 推奨）
- Pusher Channels アカウント

## セットアップ

1. 依存パッケージをインストールします。

   ```bash
   npm install
   ```

2. 環境変数を設定します。`.env.example` をコピーし、Pusher とデータベースの情報を記入してください。

   ```bash
   cp .env.example .env.local
   ```

3. Prisma クライアントを生成します。

   ```bash
   npm run prisma:generate
   ```

4. マイグレーションを適用します。

   ```bash
   npm run prisma:migrate
   ```

5. 開発サーバーを起動します。

   ```bash
   npm run dev
   ```

## スクリプト

- `npm run dev`: 開発サーバー起動
- `npm run build`: ビルド
- `npm run start`: 本番サーバー起動
- `npm run lint`: ESLint 実行
- `npm run format`: Prettier フォーマット
- `npm run prisma:generate`: Prisma クライアント生成
- `npm run prisma:migrate`: Prisma マイグレーション
- `npm run prisma:studio`: Prisma Studio 起動

## ディレクトリ

- `src/app`: Next.js App Router ルート
- `src/components`: UI コンポーネント
- `src/lib`: Prisma やゲームロジック
- `prisma`: Prisma スキーマ

## 環境変数

`.env.example` を参照してください。

## 注意事項

- ビルドが通る状態を保っています。
- バイナリファイルは含まれていません。
