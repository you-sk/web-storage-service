# Claude Code 開発ガイド

このドキュメントは、Claude Codeで開発を継続するための情報をまとめたものです。

## プロジェクト概要

**Web Storage Service** - 電子データとメタデータを管理するWebアプリケーション

### 現在の実装状況

#### ✅ 完了済み機能
- Docker Compose環境構築
- JWT認証システム（ログイン/登録）
- ファイルアップロード機能
- ファイル一覧表示
- ユーザーごとのファイル管理
- SQLiteデータベース設定
- ファイルダウンロード機能
- ファイル削除機能（確認ダイアログ付き）

#### 🚧 未実装機能
- メタデータの詳細編集UI
- タグ管理システム
- ファイル検索・フィルタリング
- ファイルプレビュー
- 複数ファイル一括アップロード

## 開発環境

### 起動方法
```bash
# Docker Composeで起動
docker-compose up -d

# ログ確認
docker-compose logs -f
```

### アクセスURL
- アプリケーション: http://localhost:8080
- API直接: http://localhost:3001
- 開発用フロント: http://localhost:5173

### 停止方法
```bash
docker-compose down
```

## ディレクトリ構造

```
web-storage-service/
├── backend/          # Express + TypeScript
├── frontend/         # React + TypeScript + Vite
├── nginx/           # リバースプロキシ設定
├── data/            # SQLiteデータ（gitignore）
├── uploads/         # アップロードファイル（gitignore）
└── docker-compose.yml
```

## データベース構造

### テーブル一覧

1. **users**
   - id (PRIMARY KEY)
   - username (UNIQUE)
   - email (UNIQUE)
   - password (hashed)
   - created_at
   - updated_at

2. **files**
   - id (PRIMARY KEY)
   - user_id (FOREIGN KEY)
   - filename
   - original_name
   - mimetype
   - size
   - path
   - metadata (JSON)
   - created_at
   - updated_at

3. **tags** (基本構造のみ実装)
   - id (PRIMARY KEY)
   - name (UNIQUE)
   - created_at

4. **file_tags** (基本構造のみ実装)
   - file_id (FOREIGN KEY)
   - tag_id (FOREIGN KEY)

## 開発を続ける際の注意点

### TypeScript設定
- `strict: true`設定のため、型エラーに注意
- 未使用変数はプレフィックス`_`を付ける（例: `_req`, `_next`）

### 認証
- JWTトークンは`Authorization: Bearer <token>`ヘッダーで送信
- トークン有効期限: 7日間
- 認証が必要なエンドポイントには`authenticateToken`ミドルウェアを使用

### ファイルアップロード
- 最大サイズ: 10MB（環境変数で変更可能）
- 保存先: `/app/uploads/`（Docker内）
- ファイル名は自動的にユニーク化される

## 次の開発ステップ（推奨順）

### 1. メタデータ編集機能の実装
```typescript
// backend/src/routes/files.ts に追加
router.put('/:id/metadata', authenticateToken, async (req, res) => {
  // メタデータ更新処理
});
```

### 2. タグ管理機能の実装
```typescript
// backend/src/routes/tags.ts を新規作成
// タグのCRUD操作
// ファイルへのタグ付け/解除
```

### 3. 検索・フィルタリング機能
```typescript
// backend/src/routes/files.ts に追加
router.get('/search', authenticateToken, async (req, res) => {
  // クエリパラメータで検索
  // タグ、ファイル名、メタデータで絞り込み
});
```

### 4. メタデータ編集機能
```typescript
// backend/src/routes/files.ts に追加
router.put('/:id/metadata', authenticateToken, async (req, res) => {
  // メタデータ更新処理
});
```

### 5. フロントエンドの機能拡張
- メタデータ編集フォーム
- タグ管理UI
- 検索バー実装
- ファイルプレビュー（画像、PDF等）

## よく使うコマンド

### Docker関連
```bash
# コンテナ再起動
docker-compose restart backend
docker-compose restart frontend

# コンテナに入る
docker-compose exec backend sh
docker-compose exec frontend sh

# ビルドし直す
docker-compose build --no-cache
```

### Git関連
```bash
# 現在の状態確認
git status

# 変更をコミット
git add .
git commit -m "feat: 機能説明"

# リモートにプッシュ
git push origin main
```

### データベース操作
```bash
# SQLiteに直接アクセス
docker-compose exec backend sqlite3 /app/data/storage.db

# テーブル確認
.tables

# スキーマ確認
.schema users
```

## トラブルシューティング

### バックエンドが起動しない
1. TypeScriptのコンパイルエラーを確認
   ```bash
   docker-compose logs backend
   ```
2. よくあるエラー:
   - 未使用変数 → `_`プレフィックスを付ける
   - 返り値の型不一致 → `Promise<Response>`を追加

### フロントエンドが表示されない
1. コンソールエラーを確認（ブラウザのDevTools）
2. APIエンドポイントの確認
3. CORSエラーの確認

### ファイルアップロードが失敗する
1. ディレクトリの権限確認
2. 最大ファイルサイズの確認（.env）
3. multerの設定確認

## 環境変数

`.env`ファイルで設定可能:

```env
# Backend
NODE_ENV=development
PORT=3001
JWT_SECRET=your-secret-key
DATABASE_PATH=/app/data/storage.db
MAX_FILE_SIZE=10485760
UPLOAD_PATH=/app/uploads

# Frontend
VITE_API_URL=http://localhost:3001
```

## テスト用アカウント

開発中に作成したテストアカウント（もしある場合はここに記載）:
- Username: (作成時に記録)
- Password: (作成時に記録)

## 参考リンク

- [Express公式ドキュメント](https://expressjs.com/)
- [React公式ドキュメント](https://react.dev/)
- [TypeScript公式ドキュメント](https://www.typescriptlang.org/docs/)
- [Docker Compose公式ドキュメント](https://docs.docker.com/compose/)
- [TailwindCSS公式ドキュメント](https://tailwindcss.com/docs)

## 開発のコツ

1. **常にDockerログを確認**: エラーの早期発見
2. **型定義を活用**: TypeScriptの型推論を最大限活用
3. **小さくコミット**: 機能ごとに細かくコミット
4. **環境変数を活用**: ハードコーディングを避ける
5. **エラーハンドリング**: try-catchとエラーミドルウェアの活用

## 今後の拡張案

### 短期的な改善
- [x] ファイル削除機能 ✅ 実装済み
- [x] ファイルダウンロード機能 ✅ 実装済み
- [ ] ユーザープロフィール編集
- [ ] パスワード変更機能
- [ ] ファイルの公開/非公開設定

### 中期的な機能追加
- [ ] フォルダ機能
- [ ] ファイル共有（リンク生成）
- [ ] コメント機能
- [ ] バージョン管理
- [ ] ゴミ箱機能

### 長期的な拡張
- [ ] チーム/組織機能
- [ ] 権限管理（Admin/User/Guest）
- [ ] API Rate Limiting
- [ ] WebSocket（リアルタイム通知）
- [ ] S3/CloudStorage連携
- [ ] 全文検索（Elasticsearch等）

## 最後に開発したセッションの情報

- **日時**: 2025-09-15
- **実装内容**:
  - ファイルダウンロード機能 (feature/file-download)
  - ファイル削除機能（feature/file-delete）
  - 確認ダイアログ付き削除UI
- **次回予定**: メタデータ編集機能またはタグ管理機能の実装を推奨

---

このドキュメントは開発を進めるごとに更新してください。