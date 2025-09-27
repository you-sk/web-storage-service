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
- メタデータ編集機能（JSON形式でのCRUD操作）
- タグ管理システム（タグの作成/削除/ファイルへの付与）
- ファイル検索・フィルタリング（名前、メタデータ、タグ、ファイルタイプで検索）
- ファイルプレビュー機能（画像、PDF、テキストファイル対応）
- 複数ファイル一括アップロード機能（最大10ファイルまで）
- ユーザープロフィール編集機能
- パスワード変更機能
- ファイルの公開/非公開設定機能（共有リンク生成）
- フォルダ機能（階層構造でのファイル管理）
- コメント機能（ファイルに対するコメント、返信、編集、削除）
- ゴミ箱機能（論理削除、復元、完全削除、一括削除）
- バージョン管理機能（ファイルの履歴管理、バージョン比較、復元）
- ユーザー権限管理（ロールベースのアクセス制御、ファイル単位の権限設定）

#### 🚧 未実装機能
- なし（主要機能はすべて実装済み）

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
   - role (TEXT DEFAULT 'user')
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
   - is_public (INTEGER DEFAULT 0)
   - public_id (TEXT UNIQUE)
   - folder_id (FOREIGN KEY)
   - deleted_at (DATETIME DEFAULT NULL - ゴミ箱機能用)
   - created_at
   - updated_at

3. **tags** (基本構造のみ実装)
   - id (PRIMARY KEY)
   - name (UNIQUE)
   - created_at

4. **file_tags** (基本構造のみ実装)
   - file_id (FOREIGN KEY)
   - tag_id (FOREIGN KEY)

5. **folders**
   - id (PRIMARY KEY)
   - user_id (FOREIGN KEY)
   - name
   - parent_id (FOREIGN KEY - self reference)
   - created_at
   - updated_at

6. **comments**
   - id (PRIMARY KEY)
   - file_id (FOREIGN KEY)
   - user_id (FOREIGN KEY)
   - content (TEXT)
   - parent_id (FOREIGN KEY - self reference for replies)
   - created_at
   - updated_at

7. **file_versions**
   - id (PRIMARY KEY)
   - file_id (FOREIGN KEY)
   - version_number (INTEGER)
   - filename
   - original_name
   - mimetype
   - size
   - path
   - metadata (TEXT)
   - change_description (TEXT)
   - created_by (FOREIGN KEY)
   - created_at
   - UNIQUE (file_id, version_number)

8. **permissions**
   - id (PRIMARY KEY)
   - name (TEXT UNIQUE)
   - description (TEXT)
   - created_at

9. **role_permissions**
   - role (TEXT)
   - permission_id (FOREIGN KEY)
   - PRIMARY KEY (role, permission_id)

10. **file_permissions**
    - id (PRIMARY KEY)
    - file_id (FOREIGN KEY)
    - user_id (FOREIGN KEY)
    - permission (TEXT CHECK IN ('view', 'edit', 'delete', 'share'))
    - granted_by (FOREIGN KEY)
    - created_at
    - UNIQUE (file_id, user_id, permission)

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

## ロールと権限について

### ユーザーロール
- **admin**: 全権限を持つ管理者
- **user**: 通常ユーザー（フォルダ作成、ファイル共有が可能）
- **guest**: ゲストユーザー（制限付きアクセス）

### 権限一覧
- `manage_users`: ユーザーアカウントの管理
- `manage_roles`: ロールの割り当てと管理
- `view_all_files`: 全ファイルの閲覧
- `delete_all_files`: 任意のファイルの削除
- `manage_system`: システム設定へのアクセス
- `create_folders`: フォルダの作成
- `delete_folders`: フォルダの削除
- `share_files`: ファイルの共有
- `manage_tags`: タグの管理
- `moderate_comments`: コメントの管理

### ファイル権限
個別のファイルに対して以下の権限を付与可能：
- `view`: ファイルの閲覧
- `edit`: ファイルの編集
- `delete`: ファイルの削除
- `share`: ファイルの共有権限の付与

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
- [x] メタデータ編集機能 ✅ 実装済み
- [x] タグ管理システム ✅ 実装済み
- [x] 検索・フィルタリング機能 ✅ 実装済み
- [x] ファイルプレビュー機能 ✅ 実装済み
- [x] 複数ファイル一括アップロード ✅ 実装済み
- [x] ユーザープロフィール編集 ✅ 実装済み
- [x] パスワード変更機能 ✅ 実装済み
- [x] ファイルの公開/非公開設定 ✅ 実装済み
- [x] フォルダ機能 ✅ 実装済み
- [x] コメント機能 ✅ 実装済み
- [x] ゴミ箱機能 ✅ 実装済み
- [x] バージョン管理 ✅ 実装済み

### 中期的な機能追加

### 長期的な拡張
- [ ] チーム/組織機能
- [ ] 権限管理（Admin/User/Guest）
- [ ] API Rate Limiting
- [ ] WebSocket（リアルタイム通知）
- [ ] S3/CloudStorage連携
- [ ] 全文検索（Elasticsearch等）

## 最後に開発したセッションの情報

- **日時**: 2025-09-26
- **実装内容**:
  - ユーザー権限管理機能の実装
  - permissions、role_permissions、file_permissionsテーブルの作成
  - ロールベースのアクセス制御（RBAC）の実装
  - 権限管理API（/api/permissions、/api/roles）の実装
  - ファイル単位の権限付与機能
  - 権限チェックミドルウェアの実装
  - UserManagementコンポーネント（管理者向けUI）の作成
  - FilePermissionsコンポーネント（ファイル権限管理UI）の作成
  - ダッシュボードに管理者メニューと権限ボタン追加
- **ブランチ**: feature/user-permissions
- **次回予定**: すべての主要機能が実装済み。パフォーマンス最適化や追加機能の検討

---

このドキュメントは開発を進めるごとに更新してください。