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

    useEffect(() => {
        setIsMounted(true);

        const fetchData = async () => {
            try {
                const [stockRes, expenseRes] = await Promise.all([
                    fetch("/api/stock"),
                    fetch("/api/expenses")
                ]);

                if (!stockRes.ok) {
                    throw new Error(`Stock API error! status: ${stockRes.status}`);
                }

                const stockJson = await stockRes.json();

                if (stockJson.error) {
                    throw new Error(stockJson.message || stockJson.error);
                }

                setStockData(stockJson);

                if (expenseRes.ok) {
                    const expenseJson = await expenseRes.json();
                    setExpenseData(expenseJson);
                } else {
                    console.warn("Expense API error:", expenseRes.status);
                }
            } catch (err) {
                console.error("Error loading data:", err);
                setStockData({ error: err.message });
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    if (!isMounted) {
        return null;
    }

    const hasStockTimeSeries =
        stockData &&
        (stockData["Time Series (Daily)"] || stockData["Monthly Time Series"]);

    const hasExpenseSeries =
        expenseData &&
        Array.isArray(expenseData.monthlyData) &&
        expenseData.monthlyData.length > 0;

    const renderStateCard = (icon, message, detail) => (
        <div className={styles.stateCard}>
            <span className={styles.stateIcon}>{icon}</span>
            <p>{message}</p>
            {detail}
        </div>
    );

    if (isLoading) {
        return <div className={styles.page}>{renderStateCard("📊", "データを読み込み中です...")}</div>;
    }

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
        return (
            <div className={styles.page}>
                {renderStateCard("❌", "株価データが見つかりませんでした。")}
            </div>
        );
    }

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
                    📈 モニター
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
                            <h1 className={styles.heroTitle}>📈 {symbol} モニター</h1>
                            <p className={styles.heroSubtitle}>
                                Alpha Vantage の月次データをキャッシュし、直近の動きをコンパクトに整理しました。
                            </p>
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
                            expenseData={expenseData}
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
