import React from "react";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from "chart.js";
import { Line } from "react-chartjs-2";
import styles from "./StockChart.module.css";

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

const StockChart = ({ stockData, showSummary = true }) => {
    console.log("📊 StockChart received data:", {
        hasStockData: !!stockData,
        stockDataKeys: stockData ? Object.keys(stockData) : [],
        hasDaily: !!(stockData && stockData["Time Series (Daily)"]),
        hasMonthly: !!(stockData && stockData["Monthly Time Series"])
    });

    if (!stockData || (!stockData["Time Series (Daily)"] && !stockData["Monthly Time Series"])) {
        console.log("❌ StockChart returning null - no valid data structure");
        return <div style={{padding: '20px', textAlign: 'center'}}>
            <p>📊 株価データの構造が無効です</p>
            <pre>{JSON.stringify({
                hasStockData: !!stockData,
                keys: stockData ? Object.keys(stockData) : []
            }, null, 2)}</pre>
        </div>;
    }

    console.log("✅ StockChart proceeding with data processing");

    const timeSeries =
        stockData["Monthly Time Series"] || stockData["Time Series (Daily)"];
    const isMonthlyData = !!stockData["Monthly Time Series"];

    const sortedData = Object.entries(timeSeries)
        .map(([date, values]) => ({
            date,
            close: parseFloat(values["4. close"]),
            open: parseFloat(values["1. open"]),
            high: parseFloat(values["2. high"]),
            low: parseFloat(values["3. low"])
        }))
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(isMonthlyData ? -24 : -30);

    const labels = sortedData.map((item) => {
        const date = new Date(item.date);
        return isMonthlyData
            ? `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}`
            : `${date.getMonth() + 1}/${date.getDate()}`;
    });

    const chartData = {
        labels,
        datasets: [
            {
                label: "終値 (Close)",
                data: sortedData.map((item) => item.close),
                borderColor: "#1E4D8F",
                backgroundColor: "rgba(30, 77, 143, 0.12)",
                borderWidth: 2.5,
                fill: true,
                tension: 0.35,
                pointBackgroundColor: "#1E4D8F",
                pointBorderColor: "#ffffff",
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            },
            {
                label: "始値 (Open)",
                data: sortedData.map((item) => item.open),
                borderColor: "#3A7BD5",
                backgroundColor: "rgba(58, 123, 213, 0.08)",
                borderWidth: 2,
                fill: false,
                tension: 0.35,
                pointBackgroundColor: "#3A7BD5",
                pointBorderColor: "#ffffff",
                pointBorderWidth: 2,
                pointRadius: 3,
                pointHoverRadius: 5
            }
        ]
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            title: {
                display: true,
                text: `S&P500 株価推移（過去${isMonthlyData ? "24ヶ月" : "30日"}）`,
                font: {
                    size: 17,
                    weight: "bold"
                },
                padding: 18
            },
            legend: {
                position: "top",
                labels: {
                    usePointStyle: true,
                    padding: 18
                }
            },
            tooltip: {
                mode: "index",
                intersect: false,
                backgroundColor: "rgba(0, 0, 0, 0.82)",
                titleColor: "#ffffff",
                bodyColor: "#ffffff",
                borderColor: "#ffffff",
                borderWidth: 1,
                callbacks: {
                    label(context) {
                        return `${context.dataset.label}: $${context.parsed.y.toFixed(2)}`;
                    }
                }
            }
        },
        scales: {
            x: {
                display: true,
                title: {
                    display: true,
                    text: isMonthlyData ? "年月" : "日付",
                    font: {
                        size: 13,
                        weight: "bold"
                    }
                },
                grid: {
                    color: "rgba(0, 0, 0, 0.08)"
                }
            },
            y: {
                display: true,
                title: {
                    display: true,
                    text: "株価 (USD)",
                    font: {
                        size: 13,
                        weight: "bold"
                    }
                },
                grid: {
                    color: "rgba(0, 0, 0, 0.08)"
                },
                ticks: {
                    callback(value) {
                        return `$${value.toFixed(0)}`;
                    }
                }
            }
        },
        interaction: {
            mode: "nearest",
            axis: "x",
            intersect: false
        }
    };

    const latestData = sortedData[sortedData.length - 1];
    const previousData = sortedData[sortedData.length - 2];

    const priceChange =
        latestData && previousData
            ? (latestData.close - previousData.close).toFixed(2)
            : 0;
    const priceChangePercent =
        latestData && previousData
            ? (
                  ((latestData.close - previousData.close) / previousData.close) *
                  100
              ).toFixed(2)
            : 0;

    const meta = stockData["Meta Data"];
    const lastRefreshed =
        meta?.["3. Last Refreshed"] || meta?.["4. Last Refreshed"] || "";

    return (
        <div className={styles.container}>
            {showSummary && latestData && (
                <div className={styles.summary}>
                    <div className={styles.summaryItem}>
                        <div className={styles.summaryLabel}>現在値</div>
                        <div className={styles.summaryValue}>
                            ${latestData.close.toFixed(2)}
                        </div>
                    </div>
                    <div className={styles.summaryItem}>
                        <div className={styles.summaryLabel}>前日比</div>
                        <div
                            className={`${styles.summaryValue} ${
                                priceChange >= 0
                                    ? styles.summaryChangePositive
                                    : styles.summaryChangeNegative
                            }`}
                        >
                            {priceChange >= 0 ? "+" : ""}
                            {priceChange}
                        </div>
                    </div>
                    <div className={styles.summaryItem}>
                        <div className={styles.summaryLabel}>前日比 (%)</div>
                        <div
                            className={`${styles.summaryValue} ${
                                priceChangePercent >= 0
                                    ? styles.summaryChangePositive
                                    : styles.summaryChangeNegative
                            }`}
                        >
                            {priceChangePercent >= 0 ? "+" : ""}
                            {priceChangePercent}%
                        </div>
                    </div>
                    {lastRefreshed && (
                        <div className={styles.summaryItem}>
                            <div className={styles.summaryLabel}>最終更新</div>
                            <div className={styles.summaryValue}>
                                {lastRefreshed.substring(0, 10)}
                            </div>
                        </div>
                    )}
                </div>
            )}
            <div className={styles.chartCard}>
                <Line data={chartData} options={options} />
            </div>
        </div>
    );
};

export default StockChart;
