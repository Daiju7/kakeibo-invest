# 🏠💰 Kakeibo-Invest: 家計簿 × 投資シミュレーター

## 📋 プロジェクト概要
家計簿機能と投資シミュレーション機能を組み合わせたWebアプリケーション。
ユーザーの支出を記録しながら、「もしその投資額でS&P500を購入していたら...」という仮想投資シミュレーションを提供します。

## 🏗️ アーキテクチャ構成

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   External API  │
│   (Next.js)     │◄──►│   (Express.js)  │◄──►│ (Alpha Vantage) │
│   Port: 3001    │    │   Port: 3000    │    │   Stock Data    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│   React         │    │     MySQL       │
│   Components    │    │   Database      │
│   Chart.js      │    │  kakeibo_data   │
└─────────────────┘    └─────────────────┘
```

## 📁 ディレクトリ構成

### `/backend/` - バックエンドサーバー (Express.js + MySQL)
```
backend/
├── server.js              # メインサーバーファイル (Express.js設定、API定義)
├── package.json           # Node.js依存関係管理
├── .env                   # 環境変数 (DB設定、API Key)
└── node_modules/          # NPMパッケージ
```

### `/frontend/kakeibo-frontend/` - フロントエンド (Next.js + React)
```
frontend/kakeibo-frontend/
├── src/app/
│   ├── page.js            # 🏠 メイン家計簿ページ (支出入力・表示)
│   ├── page.module.css    # 🎨 メインページのスタイル
│   ├── invest/
│   │   └── page.js        # 📈 投資シミュレーションページ (タブ切替UI)
│   ├── components/        # ♻️ 再利用可能なReactコンポーネント
│   │   ├── StockChart.js                  # 📊 株価チャート表示
│   │   ├── InvestmentSimulation.js       # 💰 家計簿連携投資シミュレーション
│   │   ├── VirtualInvestmentSimulator.js # 🚀 仮想投資シミュレーター
│   │   └── Cycle-Chart.js                # 🥧 円グラフ (カテゴリ別支出)
│   └── api/               # 🔌 Next.js API Routes (内部API)
│       ├── stock/
│       │   └── route.js   # 📡 株価データ取得API
│       └── expenses/
│           └── route.js   # 💾 家計簿データ取得API
├── package.json           # React/Next.js依存関係
└── node_modules/          # NPMパッケージ
```

## 🔄 データフロー

### 1. 家計簿データの流れ
```
[ユーザー入力] → [page.js] → [POST /api/kakeibo] → [MySQL] → [家計簿表示]
```

### 2. 投資シミュレーションの流れ
```
[投資ページ] → [GET /api/expenses] → [バックエンド] → [MySQL] → [投資データ抽出]
     ↓
[GET /api/stock] → [Alpha Vantage API] → [株価データ取得] → [シミュレーション計算]
     ↓
[Chart.js] → [グラフ表示] + [結果表示]
```

### 3. 仮想投資シミュレーションの流れ
```
[スライダー操作] → [リアルタイム計算] → [株価データ使用] → [結果更新]
```

## 🛠️ 使用技術スタック

### フロントエンド
- **Next.js 15** - Reactフレームワーク (App Router使用)
- **React 18** - UIライブラリ
- **Chart.js + react-chartjs-2** - グラフ表示
- **CSS Modules** - スタイリング

### バックエンド
- **Express.js** - Node.jsサーバーフレームワーク
- **MySQL2** - データベース接続
- **CORS** - クロスオリジン対応

### 外部API
- **Alpha Vantage API** - 株価データ取得

## 🔧 主要機能

### 1. 家計簿機能
- 支出の記録 (カテゴリ別: 食費、交通費、衣服、娯楽、投資、その他)
- 円グラフでの支出割合表示
- データの追加・削除

### 2. 投資シミュレーション機能
- **家計簿連携**: 実際の投資額でS&P500を購入していた場合の成果
- **仮想投資**: 任意の金額・期間での投資シミュレーション
- 一括投資 vs 積立投資の比較

### 3. データ可視化
- 株価チャート (月次データ24ヶ月)
- 投資成果のグラフ表示
- リアルタイム計算結果

## 🚀 セットアップ & 起動方法

### 1. バックエンド起動
```bash
cd backend
npm install
node server.js  # Port 3000で起動
```

### 2. フロントエンド起動
```bash
cd frontend/kakeibo-frontend
npm install
npm run dev  # Port 3001で起動
```

### 3. アクセス
- メイン家計簿: http://localhost:3001
- 投資シミュレーション: http://localhost:3001/invest

## 💡 技術的なポイント

### SSR/CSR対応
- Next.js App Routerを使用してSSR対応
- `isMounted`フラグでハイドレーションエラー回避

### API設計
- Next.js API Routesで内部API作成
- バックエンドとの通信でCORS対応

### リアルタイム計算
- React useEffectでスライダー変更を監視
- 即座に投資成果を再計算・表示

---

このプロジェクトは、家計簿と投資教育を組み合わせた実用的なWebアプリケーションです。
実際の支出データを使った投資シミュレーションにより、投資の重要性と効果を視覚的に理解できます。