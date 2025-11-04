import React from "react";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from "chart.js";
import { Line } from "react-chartjs-2";
import styles from "./InvestmentSimulation.module.css";

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

const InvestmentSimulation = ({ stockData, expenseData, showTitle = true }) => {
    if (
        !stockData ||
        !expenseData ||
        !stockData["Monthly Time Series"] ||
        !expenseData.monthlyData
    ) {
        return (
            <div className={styles.stateCard}>
                <span className={styles.stateIcon}>📊</span>
                <p>投資シミュレーションには株価データと家計簿データが必要です。</p>
            </div>
        );
    }

    const stockTimeSeries = stockData["Monthly Time Series"];
    const stockPrices = Object.entries(stockTimeSeries)
        .map(([date, values]) => ({
            date,
            price: parseFloat(values["4. close"])
        }))
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    const investmentsByMonth = expenseData.monthlyData.reduce((acc, monthData) => {
        acc[monthData.month] = monthData.totalAmount;
        return acc;
    }, {});

    console.log('📊 InvestmentSimulation Debug Info:');
    console.log('📈 Stock prices (first 3):', stockPrices.slice(0, 3));
    console.log('💰 Investments by month:', investmentsByMonth);
    console.log('📅 Stock dates available:', Object.keys(stockTimeSeries).slice(0, 5));

    const simulationData = [];
    let totalInvested = 0;
    let totalShares = 0;

    stockPrices.forEach((stockPoint) => {
        const monthKey = stockPoint.date.substring(0, 7);
        const monthlyInvestment = investmentsByMonth[monthKey] || 0;

        console.log(`📅 Processing ${monthKey}: investment=${monthlyInvestment}, stock price=${stockPoint.price}`);

        if (monthlyInvestment > 0) {
            const sharesCanBuy = monthlyInvestment / stockPoint.price;
            totalShares += sharesCanBuy;
            totalInvested += monthlyInvestment;
            console.log(`💰 Invested ${monthlyInvestment} yen, bought ${sharesCanBuy.toFixed(4)} shares, total shares: ${totalShares.toFixed(4)}`);
        }

        const currentValue = totalShares * stockPoint.price;
        const profit = currentValue - totalInvested;
        const profitPercent =
            totalInvested > 0 ? (profit / totalInvested) * 100 : 0;

        simulationData.push({
            date: stockPoint.date,
            totalInvested,
            currentValue,
            profit,
            profitPercent,
            shares: totalShares
        });
    });

    console.log('📊 Final simulation data (last 3):', simulationData.slice(-3));

    const labels = simulationData
        .filter((_, index) => index % 2 === 0)
        .map((item) => {
            const date = new Date(item.date);
            return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(
                2,
                "0"
            )}`;
        });

    const chartData = {
        labels,
        datasets: [
            {
                label: "投資元本",
                data: simulationData
                    .filter((_, index) => index % 2 === 0)
                    .map((item) => item.totalInvested),
                borderColor: "#FF6B6B",
                backgroundColor: "rgba(255, 107, 107, 0.1)",
                borderWidth: 3,
                fill: true,
                tension: 0.35,
                pointBackgroundColor: "#FF6B6B",
                pointBorderColor: "#ffffff",
                pointBorderWidth: 2,
                pointRadius: 4
            },
            {
                label: "評価額",
                data: simulationData
                    .filter((_, index) => index % 2 === 0)
                    .map((item) => item.currentValue),
                borderColor: "#4ECDC4",
                backgroundColor: "rgba(78, 205, 196, 0.15)",
                borderWidth: 3,
                fill: true,
                tension: 0.35,
                pointBackgroundColor: "#4ECDC4",
                pointBorderColor: "#ffffff",
                pointBorderWidth: 2,
                pointRadius: 4
            }
        ]
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            title: {
                display: true,
                text: "S&P500 投資シミュレーション（家計簿ベース）",
                font: {
                    size: 18,
                    weight: "bold"
                },
                padding: 18
            },
            legend: {
                position: "top",
                labels: {
                    usePointStyle: true,
                    padding: 18,
                    font: {
                        size: 13
                    }
                }
            },
            tooltip: {
                mode: "index",
                intersect: false,
                backgroundColor: "rgba(0, 0, 0, 0.82)",
                borderColor: "#ffffff",
                borderWidth: 1,
                callbacks: {
                    label(context) {
                        return `${context.dataset.label}: ¥${context.parsed.y.toLocaleString()}`;
                    }
                }
            }
        },
        scales: {
            x: {
                title: {
                    display: true,
                    text: "年月"
                },
                grid: {
                    color: "rgba(0, 0, 0, 0.08)"
                }
            },
            y: {
                title: {
                    display: true,
                    text: "金額 (JPY)"
                },
                grid: {
                    color: "rgba(0, 0, 0, 0.08)"
                },
                ticks: {
                    callback(value) {
                        return `¥${value.toLocaleString()}`;
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

    const latestData = simulationData[simulationData.length - 1];
    const totalProfitPercent = latestData ? latestData.profitPercent : 0;
    const totalProfit = latestData ? latestData.profit : 0;
    const finalValue = latestData ? latestData.currentValue : 0;
    const totalInvestmentAmount = latestData ? latestData.totalInvested : 0;

    const totalRecordedAmount =
        expenseData?.totalAmount ??
        expenseData?.monthlyData?.reduce(
            (sum, month) => sum + (month.totalAmount || 0),
            0
        ) ??
        0;

    return (
        <div className={styles.container}>
            {showTitle && <h3 className={styles.detailTitle}>💼 家計簿連携投資シミュレーション</h3>}

            <div className={styles.summaryGrid}>
                <div className={styles.metricCard}>
                    <div className={styles.metricLabel}>総投資額</div>
                    <div className={styles.metricValue}>
                        ¥{totalInvestmentAmount.toLocaleString()}
                    </div>
                </div>

                <div className={styles.metricCard}>
                    <div className={styles.metricLabel}>現在の評価額</div>
                    <div className={`${styles.metricValue} ${styles.metricPositive}`}>
                        ¥{finalValue.toLocaleString()}
                    </div>
                </div>

                <div className={styles.metricCard}>
                    <div className={styles.metricLabel}>損益</div>
                    <div
                        className={`${styles.metricValue} ${
                            totalProfit >= 0 ? styles.metricPositive : styles.metricNegative
                        }`}
                    >
                        {totalProfit >= 0 ? "+" : ""}
                        ¥{totalProfit.toLocaleString()}
                    </div>
                </div>

                <div className={styles.metricCard}>
                    <div className={styles.metricLabel}>利回り</div>
                    <div
                        className={`${styles.metricValue} ${styles.metricPercent} ${
                            totalProfitPercent >= 0
                                ? styles.metricPositive
                                : styles.metricNegative
                        }`}
                    >
                        {totalProfitPercent >= 0 ? "+" : ""}
                        {totalProfitPercent.toFixed(1)}%
                    </div>
                </div>
            </div>

            <div className={styles.chartCard}>
                <Line data={chartData} options={options} />
            </div>

            <div className={styles.detailCard}>
                <h4 className={styles.detailTitle}>📈 投資シミュレーション詳細</h4>
                <div className={styles.detailGrid}>
                    <div className={styles.detailItem}>
                        <div className={styles.detailLabel}>保有株数</div>
                        <div className={`${styles.detailValue} ${styles.detailAccent}`}>
                            {latestData ? latestData.shares.toFixed(4) : 0} 株
                        </div>
                    </div>
                    <div className={styles.detailItem}>
                        <div className={styles.detailLabel}>投資記録数</div>
                        <div className={`${styles.detailValue} ${styles.detailAccent}`}>
                            {expenseData.monthlyData.length} 回
                        </div>
                    </div>
                    <div className={styles.detailItem}>
                        <div className={styles.detailLabel}>平均投資額 / 月</div>
                        <div className={styles.detailValue}>
                            ¥
                            {expenseData.monthlyData.length > 0
                                ? Math.round(
                                      totalRecordedAmount / expenseData.monthlyData.length
                                  ).toLocaleString()
                                : 0}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InvestmentSimulation;
