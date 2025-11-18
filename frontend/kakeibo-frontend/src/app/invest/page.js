"use client";

import { useEffect, useState } from "react";
import StockChart from "../components/StockChart";
import InvestmentSimulation from "../components/InvestmentSimulation";
import VirtualInvestmentSimulator from "../components/VirtualInvestmentSimulator";
import styles from "./page.module.css";

export default function Invest() {
    const [stockData, setStockData] = useState(null);
    const [expenseData, setExpenseData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isMounted, setIsMounted] = useState(false);
    const [activeView, setActiveView] = useState("monitor"); // monitor | virtual | linked

    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://kakeibo-backend-7c1q.onrender.com";

    // トークン取得関数
    const getToken = () => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('authToken');
        }
        return null;
    };

    // APIリクエスト用のヘッダー生成
    const getAuthHeaders = () => {
        const token = getToken();
        const headers = {
            'Content-Type': 'application/json',
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        return headers;
    };

    useEffect(() => {
        setIsMounted(true);

        const fetchData = async () => {
            console.log("🔄 Starting data fetch...");
            console.log("🔄 Using API_BASE:", API_BASE);
            console.log("🔄 isLoading state:", isLoading);
            setIsLoading(true); // 明示的にローディング状態を設定

            try {
                const [stockRes, expenseRes] = await Promise.all([
                    fetch(`${API_BASE}/api/stock`),
                    fetch(`${API_BASE}/api/kakeibo`, {
                        credentials: 'include',
                        headers: getAuthHeaders()
                    })
                ]);

                console.log("📊 Stock API response status:", stockRes.status);
                console.log("💰 Expense API response status:", expenseRes.status);

                if (!stockRes.ok) {
                    const errorText = await stockRes.text();
                    console.error("❌ Stock API error details:", errorText);
                    throw new Error(`Stock API error! status: ${stockRes.status}, details: ${errorText}`);
                }

                const stockJson = await stockRes.json();
                console.log("📈 Stock data received:", stockJson ? "✅ Success" : "❌ Empty");
                console.log("📈 Full stock response:", stockJson);

                if (stockJson.error) {
                    console.error("❌ Stock data contains error:", stockJson.error);
                    setStockData({ error: stockJson.message || stockJson.error });
                    setIsLoading(false);
                    return;
                }

                // バックエンドレスポンスの data フィールドから実際の株価データを取得
                const actualStockData = stockJson.data || stockJson;
                console.log("📈 Actual stock data structure:", Object.keys(actualStockData));
                console.log("📈 Checking for Time Series data:", {
                    hasDaily: !!actualStockData["Time Series (Daily)"],
                    hasMonthly: !!actualStockData["Monthly Time Series"],
                    hasMeta: !!actualStockData["Meta Data"]
                });
                
                // データの状態を表示
                if (stockJson.status === 'old') {
                    console.warn("⚠️ Using old cached data:", stockJson.message);
                    console.log(`📅 Data age: ${stockJson.dataAge}`);
                } else if (stockJson.status === 'backup') {
                    console.warn("⚠️ Using backup data:", stockJson.message);
                    console.log(`📅 Data age: ${stockJson.dataAge}`);
                } else if (stockJson.cached) {
                    console.log(`✅ Using fresh cached data: ${stockJson.dataAge || '最新'}`);
                } else {
                    console.log("✅ Using fresh API data");
                }
                
                // 株価データにステータス情報を追加
                actualStockData._dataStatus = {
                    status: stockJson.status || 'fresh',
                    dataAge: stockJson.dataAge || '最新',
                    message: stockJson.message || null,
                    cached: stockJson.cached || false
                };
                
                console.log("📈 About to set stock data:", {
                    hasData: !!actualStockData,
                    keys: Object.keys(actualStockData)
                });
                setStockData(actualStockData);
                console.log("✅ Stock data set successfully");

                if (expenseRes.status === 401) {
                    console.warn("⚠️ Expense API requires login");
                    setExpenseData(null);
                } else if (expenseRes.ok) {
                    const expenseJson = await expenseRes.json();
                    console.log("💾 Expense data received:", expenseJson ? "✅ Success" : "❌ Empty");
                    setExpenseData(expenseJson);
                } else {
                    console.warn("⚠️ Expense API error:", expenseRes.status);
                    setExpenseData(null);
                }
                
                console.log("✅ Data fetch completed successfully");
                console.log("🔄 About to set isLoading to false (success path)");
                setIsLoading(false);
                
            } catch (err) {
                console.error("🚨 Error loading data:", err);
                console.error("🔍 Error details:", err.message);
                setStockData({ error: err.message });
                console.log("🔄 About to set isLoading to false (error path)");
                setIsLoading(false);
            }
        };

        fetchData();
    }, []); // 空の依存配列にして初回のみ実行

    if (!isMounted) {
        return null;
    }

    // 家計簿データを月次投資データに変換する関数
    const convertToMonthlyInvestmentData = (rawExpenseData) => {
        if (!Array.isArray(rawExpenseData)) return null;

        // 投資カテゴリのデータのみフィルタリング
        const investmentExpenses = rawExpenseData.filter(
            expense => expense.category === 'investment' || expense.category === '投資'
        );

        if (investmentExpenses.length === 0) return null;

        console.log('💰 Investment expenses found:', investmentExpenses);

        // 月ごとにグループ化
        const monthlyGroups = {};
        investmentExpenses.forEach(expense => {
            const date = new Date(expense.date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            
            console.log(`💰 Processing expense: ${expense.title}, amount: ${expense.amount}, date: ${expense.date} → monthKey: ${monthKey}`);
            
            if (!monthlyGroups[monthKey]) {
                monthlyGroups[monthKey] = {
                    month: monthKey,
                    totalAmount: 0,
                    entries: []
                };
            }
            
            monthlyGroups[monthKey].totalAmount += expense.amount;
            monthlyGroups[monthKey].entries.push(expense);
        });

        const monthlyData = Object.values(monthlyGroups).sort((a, b) => a.month.localeCompare(b.month));
        
        console.log('📊 Monthly investment data:', monthlyData);

        return {
            monthlyData,
            totalAmount: monthlyData.reduce((sum, month) => sum + month.totalAmount, 0)
        };
    };

    // 変換された投資データ
    const processedExpenseData = expenseData ? convertToMonthlyInvestmentData(expenseData) : null;

    const hasStockTimeSeries =
        stockData &&
        !stockData.error &&
        !!(stockData["Time Series (Daily)"] || stockData["Monthly Time Series"]);

    console.log("📊 Stock data validation:", {
        hasStockData: !!stockData,
        hasError: !!stockData?.error,
        hasDaily: !!(stockData && stockData["Time Series (Daily)"]),
        hasMonthly: !!(stockData && stockData["Monthly Time Series"]),
        hasStockTimeSeries: hasStockTimeSeries, // boolean値であることを確認
        stockDataKeys: stockData ? Object.keys(stockData).slice(0, 10) : []
    });

    console.log("🔍 Detailed stock data structure check:", {
        stockData: stockData ? "present" : "null",
        topLevelKeys: stockData ? Object.keys(stockData) : [],
        hasTimeSeriesDaily: stockData && stockData["Time Series (Daily)"] ? "YES" : "NO",
        hasMetaData: stockData && stockData["Meta Data"] ? "YES" : "NO"
    });

    console.log("🎯 Final validation result:", {
        hasStockTimeSeries: hasStockTimeSeries,
        hasStockTimeSeriesType: typeof hasStockTimeSeries,
        willRenderChart: hasStockTimeSeries === true,
        currentPath: 'about to check if (!hasStockTimeSeries)'
    });

    const hasExpenseSeries =
        processedExpenseData &&
        Array.isArray(processedExpenseData.monthlyData) &&
        processedExpenseData.monthlyData.length > 0;

    const renderStateCard = (icon, message, detail) => (
        <div className={styles.stateCard}>
            <span className={styles.stateIcon}>{icon}</span>
            <p>{message}</p>
            {detail}
        </div>
    );

    if (isLoading) {
        console.log("🔄 Currently in loading state");
        return <div className={styles.page}>{renderStateCard("📊", "データを読み込み中です...")}</div>;
    }

    console.log("✅ Not in loading state, checking data...", {
        hasStockData: !!stockData,
        stockDataKeys: stockData ? Object.keys(stockData) : [],
        hasError: stockData?.error
    });

    if (stockData && stockData.error) {
        return (
            <div className={styles.page}>
                {renderStateCard(
                    "❌",
                    "株価データの取得に失敗しました。",
                    <details>
                        <summary>トラブルシューティング</summary>
                        <ul>
                            <li>Alpha Vantage API キーの設定を確認してください。</li>
                            <li>API 制限（1分1回 / 1日20回）を超えていないか確認してください。</li>
                            <li>インターネット接続をご確認ください。</li>
                        </ul>
                    </details>
                )}
            </div>
        );
    }

    if (!hasStockTimeSeries) {
        console.log("❌ No stock time series data available - SHOWING ERROR PAGE");
        console.log("❌ Debug: hasStockTimeSeries =", hasStockTimeSeries, "type:", typeof hasStockTimeSeries);
        return (
            <div className={styles.page}>
                {renderStateCard("❌", "株価データが見つかりませんでした。", 
                    <div>
                        <p>デバッグ情報:</p>
                        <pre>{JSON.stringify({
                            hasStockData: !!stockData,
                            stockDataKeys: stockData ? Object.keys(stockData).slice(0, 5) : [],
                            hasError: !!stockData?.error,
                            error: stockData?.error,
                            hasStockTimeSeries: hasStockTimeSeries,
                            hasStockTimeSeriesType: typeof hasStockTimeSeries
                        }, null, 2)}</pre>
                    </div>
                )}
            </div>
        );
    }

    console.log("✅ Stock time series data available - PROCEEDING TO CHART");

    const timeSeries =
        stockData["Monthly Time Series"] || stockData["Time Series (Daily)"];
    const sortedEntries = Object.entries(timeSeries).sort(
        (a, b) => new Date(b[0]) - new Date(a[0])
    );

    const [latestEntry, previousEntry] = sortedEntries;
    const latestDate = latestEntry ? latestEntry[0] : null;
    const latestClose = latestEntry
        ? parseFloat(latestEntry[1]["4. close"])
        : 0;
    const previousClose = previousEntry
        ? parseFloat(previousEntry[1]["4. close"])
        : null;

    const priceChange =
        latestClose !== null && previousClose !== null
            ? Number((latestClose - previousClose).toFixed(2))
            : 0;
    const priceChangePercent =
        latestClose !== null && previousClose
            ? Number((((latestClose - previousClose) / previousClose) * 100).toFixed(2))
            : 0;

    const meta = stockData["Meta Data"];
    const symbol = meta?.["2. Symbol"] || "SPY";
    const lastRefreshed =
        meta?.["3. Last Refreshed"] ||
        meta?.["4. Last Refreshed"] ||
        (latestDate ? latestDate.substring(0, 10) : "");

    return (
        <div className={styles.page}>
            <div className={styles.viewTabs}>
                <button
                    type="button"
                    className={`${styles.viewTab} ${activeView === "monitor" ? styles.activeViewTab : ""}`}
                    onClick={() => setActiveView("monitor")}
                >
                    📈 基準価額
                </button>
                <button
                    type="button"
                    className={`${styles.viewTab} ${activeView === "virtual" ? styles.activeViewTab : ""}`}
                    onClick={() => setActiveView("virtual")}
                >
                    🚀 仮想投資
                </button>
                <button
                    type="button"
                    className={`${styles.viewTab} ${activeView === "linked" ? styles.activeViewTab : ""}`}
                    onClick={() => setActiveView("linked")}
                >
                    💼 家計簿連携
                </button>
            </div>

            {activeView === "monitor" && (
                <>
                    <section className={styles.heroCard}>
                        <div className={styles.heroHeader}>
                            <h1 className={styles.heroTitle}>📈 S&P500 基準価額</h1>
                            {stockData._dataStatus && (
                                <div className={styles.dataStatus}>
                                    {stockData._dataStatus.status === 'fresh' ? (
                                        <span className={styles.statusFresh}>
                                            ✅ {stockData._dataStatus.dataAge}のデータ
                                        </span>
                                    ) : stockData._dataStatus.status === 'old' ? (
                                        <span className={styles.statusOld}>
                                            ⚠️ {stockData._dataStatus.dataAge}のデータ（API制限中）
                                        </span>
                                    ) : stockData._dataStatus.status === 'backup' ? (
                                        <span className={styles.statusBackup}>
                                            ⚠️ {stockData._dataStatus.dataAge}のデータ（APIエラー）
                                        </span>
                                    ) : null}
                                </div>
                            )}
                        </div>
                        <div className={styles.heroMetrics}>
                            <div className={styles.metricPill}>
                                <div className={styles.metricLabel}>現在値</div>
                                <div className={styles.metricValue}>${latestClose.toFixed(2)}</div>
                            </div>
                            <div className={styles.metricPill}>
                                <div className={styles.metricLabel}>前月比</div>
                                <div
                                    className={`${styles.metricValue} ${
                                        priceChange >= 0 ? styles.metricPositive : styles.metricNegative
                                    }`}
                                >
                                    {priceChange >= 0 ? "+" : ""}
                                    {priceChange.toFixed(2)}
                                </div>
                            </div>
                            <div className={styles.metricPill}>
                                <div className={styles.metricLabel}>前月比 (%)</div>
                                <div
                                    className={`${styles.metricValue} ${
                                        priceChangePercent >= 0 ? styles.metricPositive : styles.metricNegative
                                    }`}
                                >
                                    {priceChangePercent >= 0 ? "+" : ""}
                                    {priceChangePercent.toFixed(2)}%
                                </div>
                            </div>
                            <div className={styles.metricPill}>
                                <div className={styles.metricLabel}>最終更新</div>
                                <div className={styles.metricValue}>{lastRefreshed}</div>
                            </div>
                        </div>
                    </section>

                    <section className={styles.chartCard}>
                        <h2 className={styles.sectionTitle}>📊 株価チャート</h2>
                        <StockChart stockData={stockData} showSummary={false} />
                    </section>
                </>
            )}

            {activeView === "virtual" && (
                <section className={styles.simulationCard}>
                    <h2 className={styles.sectionTitle}>🚀 仮想投資シミュレーション</h2>
                    <VirtualInvestmentSimulator stockData={stockData} showTitle={false} />
                </section>
            )}

            {activeView === "linked" && (
                <section className={styles.simulationCard}>
                    <h2 className={styles.sectionTitle}>💼 家計簿連携シミュレーション</h2>
                    {hasExpenseSeries ? (
                        <InvestmentSimulation
                            stockData={stockData}
                            expenseData={processedExpenseData}
                            showTitle={false}
                        />
                    ) : (
                        <div className={styles.emptyState}>
                            <div className={styles.emptyIcon}>💡</div>
                            <div className={styles.emptyTitle}>家計簿データが必要です</div>
                            <p>
                                家計簿アプリで「投資」カテゴリーの支出を記録すると、
                                S&P500 を用いた実績シミュレーションが表示されます。
                            </p>
                            <p className={styles.emptyNote}>
                                まずは仮想投資シミュレーションでイメージをつかんでみましょう。
                            </p>
                        </div>
                    )}
                </section>
            )}
        </div>
    );
}
