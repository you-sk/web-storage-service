# Web Storage Service

電子データの保存とメタデータ管理を行うWebアプリケーションです。ファイルをアップロードし、タグやカテゴリなどのメタデータを付与して管理できます。

## 特徴

- 🔐 **セキュアな認証**: JWT認証によるセキュアなアクセス管理
- 📁 **ファイル管理**: 様々な形式のファイルをアップロード・保存・ダウンロード・削除
- 🏷️ **メタデータ管理**: ファイルにJSONメタデータやタグを付与して整理
- 🔍 **検索機能**: ファイル名、メタデータ、タグ、ファイルタイプによる検索・フィルタリング
- 👁️ **ファイルプレビュー**: 画像、PDF、テキストファイルのブラウザ内プレビュー
- 🐳 **Docker対応**: Docker Composeによる簡単な環境構築
- 📱 **レスポンシブデザイン**: モバイル・デスクトップ両対応

## 技術スタック

### フロントエンド
- **React 18** - UIライブラリ
- **TypeScript** - 型安全な開発
- **Vite** - 高速な開発環境
- **TailwindCSS** - ユーティリティファーストCSS
- **React Router** - ルーティング
- **Zustand** - 状態管理
- **React Query** - サーバー状態管理
- **Lucide React** - アイコンライブラリ

### バックエンド
- **Node.js** - JavaScriptランタイム
- **Express** - Webフレームワーク
- **TypeScript** - 型安全な開発
- **SQLite** - 軽量データベース（開発環境）
- **JWT** - 認証トークン
- **bcrypt** - パスワードハッシュ化
- **Multer** - ファイルアップロード処理

### インフラ
- **Docker** - コンテナ化
- **Docker Compose** - マルチコンテナ管理
- **Nginx** - リバースプロキシ

## 必要環境

- Docker Desktop (Windows/Mac) または Docker Engine (Linux)
- Docker Compose
- Git

## セットアップ

### 1. リポジトリのクローン

```bash
git clone https://github.com/[your-username]/web-storage-service.git
cd web-storage-service
```

### 2. 環境変数の設定

```bash
cp .env.example .env
# 必要に応じて.envファイルを編集
```

### 3. Dockerコンテナの起動

```bash
# 初回起動（ビルド込み）
docker-compose up --build

# 2回目以降
docker-compose up

# バックグラウンドで起動
docker-compose up -d
```

### 4. アプリケーションへのアクセス

起動が完了したら、以下のURLでアクセスできます：

- **アプリケーション**: http://localhost:8080
- **API（直接アクセス）**: http://localhost:3001
- **開発用フロントエンド**: http://localhost:5173

## 使い方

### 初回利用

1. ブラウザで http://localhost:8080 にアクセス
2. 「Don't have an account? Sign up」をクリックして新規アカウント作成
3. ユーザー名、メールアドレス、パスワードを入力して登録
4. 登録完了後、自動的にログインされダッシュボードへ遷移

### ファイルのアップロード

#### 単一ファイルのアップロード
1. ダッシュボードの「Single File Upload」セクションで「Choose File」をクリック
2. アップロードしたいファイルを選択
3. 「Upload File」ボタンをクリック
4. アップロード完了後、ファイル一覧に表示される

#### 複数ファイルの一括アップロード
1. ダッシュボードの「Multiple Files Upload」セクションで「Choose Files」をクリック
2. 複数のファイルを選択（最大10ファイルまで）
3. 選択されたファイル一覧と合計サイズを確認
4. 「Upload X Files」ボタンをクリック
5. アップロード完了後、ファイル一覧に表示される

### ファイルのダウンロード

1. ファイル一覧から対象ファイルの「Download」ボタンをクリック
2. ファイルがダウンロードされます

### ファイルの削除

1. ファイル一覧から対象ファイルの「Delete」ボタンをクリック
2. 確認ダイアログで「Delete」をクリック
3. ファイルが削除されます

### ファイルのプレビュー

1. ファイル一覧から対象ファイルの「Preview」ボタンをクリック
2. プレビューモーダルが開き、ファイル内容が表示されます
3. 対応形式：画像（JPEG、PNG、GIF等）、PDF、テキストファイル（TXT、JSON、CSV、XML等）

### メタデータの編集

1. ファイル一覧から対象ファイルの「Metadata」ボタンをクリック
2. JSON形式でメタデータを編集
3. 「Save」をクリックして保存

### タグの管理

1. 「Manage Tags」ボタンをクリックしてタグマネージャーを開く
2. 新しいタグの作成や既存タグの削除が可能
3. 各ファイルの「Tags」ボタンからファイルにタグを付与

### ファイルの検索・フィルタリング

1. 検索バーにキーワードを入力（ファイル名やメタデータを検索）
2. ファイルタイプでフィルタリング（画像、PDF、テキスト等）
3. タグでフィルタリング（複数選択可能）
4. 「Search」ボタンをクリックして検索実行

### ユーザープロフィール管理

1. 画面上部の「Profile」リンクをクリック
2. ユーザー名やメールアドレスを編集（「Edit Profile」ボタン）
3. パスワードを変更（「Change Password」ボタン）

### ログアウト

画面右上の「Logout」ボタンをクリック

## 開発

### ディレクトリ構成

```
web-storage-service/
├── backend/               # バックエンドアプリケーション
│   ├── src/
│   │   ├── config/       # 設定ファイル
│   │   ├── controllers/  # コントローラー
│   │   ├── middleware/   # ミドルウェア
│   │   ├── models/       # データモデル
│   │   ├── routes/       # APIルート
│   │   ├── utils/        # ユーティリティ
│   │   └── index.ts      # エントリーポイント
│   ├── Dockerfile.dev    # 開発用Dockerfile
│   ├── package.json
│   └── tsconfig.json
├── frontend/             # フロントエンドアプリケーション
│   ├── src/
│   │   ├── components/   # UIコンポーネント
│   │   ├── hooks/        # カスタムフック
│   │   ├── pages/        # ページコンポーネント
│   │   ├── services/     # API通信
│   │   ├── store/        # 状態管理
│   │   ├── types/        # 型定義
│   │   └── App.tsx       # メインコンポーネント
│   ├── Dockerfile.dev    # 開発用Dockerfile
│   ├── package.json
│   └── vite.config.ts
├── nginx/                # Nginx設定
│   └── nginx.conf
├── data/                 # SQLiteデータベース（gitignore）
├── uploads/              # アップロードファイル（gitignore）
├── docker-compose.yml    # Docker Compose設定
├── .env.example          # 環境変数テンプレート
├── .gitignore
└── README.md
```

### 開発コマンド

```bash
# コンテナのログを確認
docker-compose logs -f

# 特定のサービスのログを確認
docker-compose logs -f backend
docker-compose logs -f frontend

# コンテナの再起動
docker-compose restart

# コンテナの停止
docker-compose down

# コンテナとボリュームを削除（データも削除）
docker-compose down -v

# コンテナに入る
docker-compose exec backend sh
docker-compose exec frontend sh
```

### API エンドポイント

#### 認証

- `POST /api/auth/register` - ユーザー登録
  ```json
  {
    "username": "string",
    "email": "string",
    "password": "string"
  }
  ```

- `POST /api/auth/login` - ログイン
  ```json
  {
    "username": "string",
    "password": "string"
  }
  ```

- `GET /api/auth/me` - ユーザー情報取得（要認証）

#### ファイル管理

- `POST /api/files/upload` - 単一ファイルアップロード（要認証）
  - multipart/form-data
  - フィールド: `file`, `metadata`（オプション）

- `POST /api/files/upload-multiple` - 複数ファイル一括アップロード（要認証）
  - multipart/form-data
  - フィールド: `files[]`（最大10ファイル）, `metadata`（オプション）

- `GET /api/files` - ファイル一覧取得（要認証）

- `GET /api/files/:id` - ファイル詳細取得（要認証）

- `GET /api/files/:id/download` - ファイルダウンロード（要認証）

- `GET /api/files/:id/preview` - ファイルプレビュー（要認証）
  - 画像・PDFは直接返却
  - テキストファイルはJSON形式で返却

- `PUT /api/files/:id/metadata` - メタデータ更新（要認証）
  ```json
  {
    "metadata": {}
  }
  ```

- `DELETE /api/files/:id` - ファイル削除（要認証）

- `GET /api/files/search` - ファイル検索（要認証）
  - クエリパラメータ: `query`, `tagIds`, `type`

#### タグ管理

- `GET /api/tags` - タグ一覧取得（要認証）

- `POST /api/tags` - タグ作成（要認証）
  ```json
  {
    "name": "string"
  }
  ```

- `DELETE /api/tags/:id` - タグ削除（要認証）

- `GET /api/tags/file/:fileId` - ファイルのタグ取得（要認証）

- `PUT /api/tags/file/:fileId` - ファイルのタグ更新（要認証）
  ```json
  {
    "tagIds": ["1", "2", "3"]
  }
  ```

#### ユーザー管理

- `GET /api/users/profile` - ユーザープロフィール取得（要認証）

- `PUT /api/users/profile` - ユーザープロフィール更新（要認証）
  ```json
  {
    "username": "string",
    "email": "string"
  }
  ```

- `POST /api/users/change-password` - パスワード変更（要認証）
  ```json
  {
    "currentPassword": "string",
    "newPassword": "string"
  }
  ```

#### ヘルスチェック

- `GET /api/health` - APIの稼働状態確認

## トラブルシューティング

### ポートが使用中の場合

他のアプリケーションが同じポートを使用している場合：

```bash
# 使用中のポートを確認
lsof -i :8080
lsof -i :3001
lsof -i :5173

# docker-compose.ymlでポートを変更
# 例: 8080:80 → 8081:80
```

### データベースのリセット

```bash
# データベースファイルを削除
rm -rf data/*

# コンテナを再起動
docker-compose restart backend
```

### 依存関係の更新

```bash
# バックエンドの依存関係更新
docker-compose exec backend npm update

# フロントエンドの依存関係更新
docker-compose exec frontend npm update

# イメージの再ビルド
docker-compose build --no-cache
```

## 今後の実装予定

- [x] ファイル検索・フィルタリング機能
- [x] タグ・カテゴリの詳細管理
- [x] ファイルプレビュー機能
- [x] メタデータ編集機能
- [x] ファイルのダウンロード機能
- [x] ファイルの削除機能
- [x] 複数ファイルの一括アップロード
- [x] ユーザープロフィール編集
- [x] パスワード変更機能
- [ ] ファイルの公開/非公開設定
- [ ] ユーザー権限管理
- [ ] ファイル共有機能
- [ ] バージョン管理
- [ ] PostgreSQL対応（本番環境用）
- [ ] S3等のクラウドストレージ対応

## セキュリティ

- パスワードは bcrypt でハッシュ化して保存
- JWT トークンによる認証（有効期限: 7日）
- 環境変数による機密情報の管理
- CORS設定による不正なアクセスの防止

## コントリビューション

1. このリポジトリをフォーク
2. フィーチャーブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add some amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

## ライセンス

MIT License - 詳細は [LICENSE](LICENSE) ファイルを参照してください。

## 作者

[you-sk](https://github.com/you-sk)

## 謝辞

このプロジェクトは以下の素晴らしいオープンソースプロジェクトを使用しています：

- React
- Node.js
- Docker
- その他多くのオープンソースライブラリ
