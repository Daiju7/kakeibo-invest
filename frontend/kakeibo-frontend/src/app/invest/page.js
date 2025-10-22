/**
 * 📈 Invest Page - 投資シミュレーション統合ページ
 * 
 * 【ページの役割】
 * - 3つの投資関連機能をタブで切り替え可能な統合UI
 * - 株価データと家計簿データを並行取得
 * - SSR対応とエラーハンドリング
 * - レスポンシブデザインによるモバイル対応
 * 
 * 【3つのタブ機能】
 * 1. 🚀 仮想投資: インタラクティブな投資シミュレーター
 * 2. 📊 株価チャート: S&P500の長期株価データ表示
 * 3. 💰 家計簿連携: 実際の投資データに基づくシミュレーション
 * 
 * 【データフロー】
 * 1. 株価データ: /api/stock → Alpha Vantage API → 月次データ取得
 * 2. 家計簿データ: /api/expenses → バックエンド → MySQL → 投資カテゴリー抽出
 * 3. 各コンポーネントにpropsでデータを渡して描画
 */

"use client"; // Next.js App Router - クライアントコンポーネント指定

// 【React Hooks & コンポーネントのインポート】
import { useEffect, useState } from "react";
import StockChart from "../components/StockChart";                      // 📊 株価チャート
import InvestmentSimulation from "../components/InvestmentSimulation";   // 💰 家計簿連携シミュレーション
import VirtualInvestmentSimulator from "../components/VirtualInvestmentSimulator"; // 🚀 仮想投資

export default function Invest() {
    // 【状態管理】React Hooksによるコンポーネント状態　
    const [stockData, setStockData] = useState(null);        // 株価データ (Alpha Vantage API)
    const [expenseData, setExpenseData] = useState(null);    // 家計簿データ (MySQL)
    const [isLoading, setIsLoading] = useState(true);        // ローディング状態
    const [isMounted, setIsMounted] = useState(false);       // SSR/CSR 判定フラグ
    const [activeTab, setActiveTab] = useState('virtual');   // アクティブタブ ('chart', 'simulation', 'virtual')

    // 【副作用フック】コンポーネントマウント時のデータ取得
    useEffect(() => {
        // SSR対応: クライアントサイドでのマウント完了を記録
        setIsMounted(true);
        
        /**
         * 【非同期データ取得関数】
         * 株価データと家計簿データを並行取得
         */
        // 非同期関数を定義し、並列処理でデータを取得する。
        const fetchData = async () => {
            try {
                console.log("Fetching stock data and expense data...");
                
                // 【並行API呼び出し】Promise.allで同時実行により高速化
                //promise.allは複数の非同期操作を並行して実行し、すべての操作が完了するまで待機するためのメソッド。
                const [stockRes, expenseRes] = await Promise.all([
                    fetch("/api/stock"),     // Next.js API Route → Alpha Vantage
                    fetch("/api/expenses")   // Next.js API Route → Express.js → MySQL
                ]);
                
                console.log("Stock response status:", stockRes.status);
                console.log("Expense response status:", expenseRes.status);
                
                // 【株価データの処理】必須データのため、エラー時は例外投げる
                if (!stockRes.ok) {
                    throw new Error(`Stock API error! status: ${stockRes.status}`);
                }
                
                const stockData = await stockRes.json(); // 株価データJSON解析。fetchで取得したレスポンスをJSON形式に変換している。
                console.log("Stock data received:", stockData);　//stockDataとは、Alpha Vantage APIから取得した株価データを格納しているオブジェクト
                
                // Alpha Vantage APIからのエラーレスポンスをチェック
                if (stockData.error) {
                    throw new Error(stockData.message || stockData.error);
                }
                
                setStockData(stockData); // 状態更新 
                //株価データを状態に保存することで、後続のコンポーネントで利用可能にしている。このタイミングで状態を更新することで、レンダリングがトリガーされ、UIが最新のデータで更新される。
                
                // 【家計簿データの処理】オプションデータのため、エラーでも処理続行
                //オプションデータとは、例えば家計簿データが取得できなかった場合でも、アプリ全体の動作に致命的な影響を与えないデータのことを指します。したがって、家計簿データの取得に失敗しても、ユーザーには警告を表示するだけで、他の機能は引き続き利用可能にします。
                //何で家計簿データの取得がオプション扱いなのかというと、投資シミュレーション自体は株価データがあれば基本的に動作するため、家計簿データがなくても主要な機能には影響しないからです。
                //ただ、家計簿データがあるとよりリアルなシミュレーションが可能になるため、あくまで補助的なデータとして扱っています。具体的には、家計簿データがなくても仮想投資シミュレーターや株価チャートの表示は問題なく行えますが、実際の投資履歴に基づくシミュレーションを行う場合には家計簿データが必要となります。
                if (expenseRes.ok) {
                    const expenseData = await expenseRes.json();
                    console.log("Expense data received:", expenseData);
                    
                    // 正常なデータの場合のみ状態更新
                    if (!expenseData.error) {
                        setExpenseData(expenseData);
                    } else {
                        console.warn("Expense data error:", expenseData.message);
                    }
                } else {
                    // バックエンド接続エラー等でも警告のみ出力
                    console.warn("Failed to fetch expense data:", expenseRes.status);
                }
                
            } catch (err) {
                // 【エラーハンドリング】ユーザーに分かりやすいエラー表示
                console.error("データ取得失敗:", err);
                setStockData({ error: err.message });
            } finally {
                // 【ローディング終了】成功・失敗に関わらずローディング状態を解除
                setIsLoading(false);
            }
        };

        fetchData(); // 非同期関数を実行
    }, []); // 依存配列が空なので、マウント時のみ実行

    // 【SSR対応】サーバーサイドレンダリング中は何も表示しない　
    //サーバーサイドレンダリング　＝＞サーバー側でコンポーネントをレンダリングし、その結果をHTMLとしてクライアントに送信するプロセス。
    //ハイドレーションエラー　＝＞サーバーでレンダリングされたHTMLとクライアント側でReactが生成するDOMが一致しない場合に発生するエラー。これにより、ユーザーインターフェースの不整合や予期しない動作が起こる可能性があります。

    // ハイドレーションエラーを防ぐための仕組み
    //具体的には、コンポーネントがクライアント側で完全にマウントされるまで、何もレンダリングしないようにしています。これにより、サーバーとクライアントのレンダリング結果の不一致を防ぎ、ハイドレーションエラーを回避します。
    if (!isMounted) {
        return null;
    }

    return (
        <main style={{ 
            padding: "2rem",
            maxWidth: "1200px",
            margin: "0 auto",
            background: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
            minHeight: "100vh"
        }}>
            <h1 style={{
                textAlign: "center",
                fontSize: "2.5rem",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                marginBottom: "2rem"
            }}>
                📈 S&P500株価データ
            </h1>
            {isLoading ? (
                <div style={{ textAlign: "center", padding: "2rem" }}>
                    <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>📊</div>
                    <p>データを読み込み中...</p>
                </div>
            ) : stockData && stockData.error ? (
                <div style={{ textAlign: "center", padding: "2rem" }}>
                    <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>❌</div>
                    <h3>エラーが発生しました</h3>
                    <p style={{ color: "#e74c3c", background: "#fdf2f2", padding: "1rem", borderRadius: "8px" }}>
                        {stockData.error}
                    </p>
                    <details style={{ marginTop: "1rem", textAlign: "left" }}>
                        <summary>トラブルシューティング</summary>
                        <ul style={{ margin: "1rem 0", paddingLeft: "2rem" }}>
                            <li>Alpha Vantage API キーが正しく設定されているか確認してください</li>
                            <li>API制限に達していないか確認してください（1日5回、1分1回）</li>
                            <li>インターネット接続を確認してください</li>
                        </ul>
                    </details>
                </div>
            ) : stockData && (stockData["Time Series (Daily)"] || stockData["Monthly Time Series"]) ? (
                <div>
                    {/* タブナビゲーション */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        marginBottom: '2rem',
                        background: 'white',
                        borderRadius: '50px',
                        padding: '0.5rem',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
                        maxWidth: '600px',
                        margin: '0 auto 2rem auto'
                    }}>
                        <button
                            onClick={() => setActiveTab('virtual')}
                            style={{
                                flex: 1,
                                padding: '1rem 1.5rem',
                                borderRadius: '25px',
                                border: 'none',
                                background: activeTab === 'virtual' ? 
                                    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent',
                                color: activeTab === 'virtual' ? 'white' : '#666',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                fontSize: '0.9rem'
                            }}
                        >
                            🚀 仮想投資
                        </button>
                        <button
                            onClick={() => setActiveTab('chart')}
                            style={{
                                flex: 1,
                                padding: '1rem 1.5rem',
                                borderRadius: '25px',
                                border: 'none',
                                background: activeTab === 'chart' ? 
                                    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent',
                                color: activeTab === 'chart' ? 'white' : '#666',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                fontSize: '0.9rem'
                            }}
                        >
                            📊 株価チャート
                        </button>
                        <button
                            onClick={() => setActiveTab('simulation')}
                            style={{
                                flex: 1,
                                padding: '1rem 1.5rem',
                                borderRadius: '25px',
                                border: 'none',
                                background: activeTab === 'simulation' ? 
                                    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent',
                                color: activeTab === 'simulation' ? 'white' : '#666',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                fontSize: '0.9rem'
                            }}
                        >
                            💰 家計簿連携
                        </button>
                    </div>

                    {/* タブコンテンツ */}
                    {activeTab === 'virtual' && (
                        <VirtualInvestmentSimulator stockData={stockData} />
                    )}

                    {activeTab === 'chart' && (
                        <StockChart stockData={stockData} />
                    )}

                    {activeTab === 'simulation' && (
                        <div>
                            {/* 投資シミュレーションセクション */}
                            {expenseData && expenseData.monthlyData && expenseData.monthlyData.length > 0 ? (
                                <div>
                                    <div style={{
                                        textAlign: 'center',
                                        marginBottom: '2rem',
                                        padding: '1.5rem',
                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                        borderRadius: '12px',
                                        color: 'white'
                                    }}>
                                        <h2 style={{ margin: 0, fontSize: '1.8rem' }}>
                                            � 家計簿連携投資シミュレーション
                                        </h2>
                                        <p style={{ margin: '0.5rem 0 0 0', opacity: 0.9 }}>
                                            あなたの投資がS&P500だったらどうなっていたか？
                                        </p>
                                    </div>
                                    <InvestmentSimulation stockData={stockData} expenseData={expenseData} />
                                </div>
                            ) : (
                                <div style={{
                                    textAlign: 'center',
                                    padding: '3rem',
                                    background: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
                                    borderRadius: '12px',
                                    color: '#8B4513'
                                }}>
                                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💡</div>
                                    <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>家計簿連携シミュレーションを見るには</h3>
                                    <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>家計簿アプリで「投資」カテゴリーの支出を記録してください！</p>
                                    <p style={{ fontSize: '0.9rem', opacity: 0.8 }}>
                                        記録された投資額を基に、S&P500への投資シミュレーションを表示します
                                    </p>
                                    <div style={{
                                        marginTop: '2rem',
                                        padding: '1rem',
                                        background: 'rgba(255, 255, 255, 0.3)',
                                        borderRadius: '8px',
                                        fontSize: '0.9rem'
                                    }}>
                                        💡 ヒント: まずは「🚀 仮想投資」タブで投資シミュレーションを試してみてください！
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ) : (
                <div style={{ textAlign: "center", padding: "2rem" }}>
                    <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>❌</div>
                    <p>データの取得に失敗しました</p>
                    <p style={{ fontSize: "0.9rem", color: "#666" }}>
                        コンソールでエラーの詳細を確認してください
                    </p>
                </div>
            )}
        </main>
    );
}