import React, { useEffect, useState } from "react";
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
import styles from "./VirtualInvestmentSimulator.module.css";

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

const VirtualInvestmentSimulator = ({ stockData, showTitle = true }) => {
    const [investmentAmount, setInvestmentAmount] = useState(1000000);
    const [yearsAgo, setYearsAgo] = useState(5);
    const [investmentType, setInvestmentType] = useState("lump");
    const [simulationResult, setSimulationResult] = useState(null);

    useEffect(() => {
        if (stockData && stockData["Monthly Time Series"]) {
            calculateSimulation();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [investmentAmount, yearsAgo, investmentType, stockData]);

    const calculateSimulation = () => {
        if (!stockData || !stockData["Monthly Time Series"]) return;

        const timeSeries = stockData["Monthly Time Series"];
        const sortedData = Object.entries(timeSeries)
            .map(([date, values]) => ({
                date,
                price: parseFloat(values["4. close"])
            }))
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        if (sortedData.length === 0) return;

        const currentDate = new Date();
        const targetDate = new Date(
            currentDate.getFullYear() - yearsAgo,
            currentDate.getMonth(),
            1
        );

        const startPoint =
            sortedData.find((item) => new Date(item.date) >= targetDate) ||
            sortedData[0];
        const currentPoint = sortedData[sortedData.length - 1];

        if (!startPoint || !currentPoint) return;

        let result;

        if (investmentType === "lump") {
            const shares = investmentAmount / startPoint.price;
            const currentValue = shares * currentPoint.price;
            const profit = currentValue - investmentAmount;
            const profitPercent =
                investmentAmount > 0 ? (profit / investmentAmount) * 100 : 0;
            const annualReturn =
                investmentAmount > 0
                    ? Math.pow(currentValue / investmentAmount, 1 / yearsAgo) - 1
                    : 0;

            result = {
                type: "lump",
                startDate: startPoint.date,
                startPrice: startPoint.price,
                currentPrice: currentPoint.price,
                shares,
                investedAmount: investmentAmount,
                currentValue,
                profit,
                profitPercent,
                annualReturn: annualReturn * 100,
                chartData: generateLumpSumChart(
                    sortedData,
                    startPoint,
                    investmentAmount
                )
            };
        } else {
            const monthlyAmount = investmentAmount / (yearsAgo * 12);
            let totalShares = 0;
            let totalInvested = 0;
            const investmentHistory = [];

            const relevantData = sortedData.filter(
                (item) => new Date(item.date) >= new Date(startPoint.date)
            );

            for (
                let i = 0;
                i < relevantData.length && i < yearsAgo * 12;
                i += 1
            ) {
                const monthData = relevantData[i];
                const shares = monthlyAmount / monthData.price;
                totalShares += shares;
                totalInvested += monthlyAmount;

                const currentValue = totalShares * currentPoint.price;

                investmentHistory.push({
                    date: monthData.date,
                    monthlyInvestment: monthlyAmount,
                    totalInvested,
                    shares: totalShares,
                    currentValue,
                    profit: currentValue - totalInvested
                });
            }

            const finalCurrentValue = totalShares * currentPoint.price;
            const finalProfit = finalCurrentValue - totalInvested;
            const finalProfitPercent =
                totalInvested > 0 ? (finalProfit / totalInvested) * 100 : 0;
            const annualReturn =
                totalInvested > 0
                    ? Math.pow(finalCurrentValue / totalInvested, 1 / yearsAgo) - 1
                    : 0;

            result = {
                type: "monthly",
                startDate: startPoint.date,
                monthlyAmount,
                totalMonths: Math.min(relevantData.length, yearsAgo * 12),
                shares: totalShares,
                investedAmount: totalInvested,
                currentValue: finalCurrentValue,
                profit: finalProfit,
                profitPercent: finalProfitPercent,
                annualReturn: annualReturn * 100,
                investmentHistory,
                chartData: generateMonthlyChart(investmentHistory)
            };
        }

        setSimulationResult(result);
    };

    const generateLumpSumChart = (sortedData, startPoint, amount) => {
        const startIndex = sortedData.findIndex(
            (item) => item.date === startPoint.date
        );
        const relevantData = sortedData.slice(startIndex);
        const shares = amount / startPoint.price;

        const labels = relevantData
            .filter((_, index) => index % 3 === 0)
            .map((item) => {
                const date = new Date(item.date);
                return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(
                    2,
                    "0"
                )}`;
            });

        const valueData = relevantData
            .filter((_, index) => index % 3 === 0)
            .map((item) => shares * item.price);

        return {
            labels,
            datasets: [
                {
                    label: "投資元本",
                    data: new Array(labels.length).fill(amount),
                    borderColor: "#FF6B6B",
                    backgroundColor: "rgba(255, 107, 107, 0.08)",
                    borderWidth: 2,
                    borderDash: [6, 6],
                    fill: false,
                    tension: 0.3
                },
                {
                    label: "評価額",
                    data: valueData,
                    borderColor: "#4ECDC4",
                    backgroundColor: "rgba(78, 205, 196, 0.18)",
                    borderWidth: 3,
                    fill: true,
                    tension: 0.35
                }
            ]
        };
    };

    const generateMonthlyChart = (history) => {
        const labels = history
            .filter((_, index) => index % 6 === 0)
            .map((item) => {
                const date = new Date(item.date);
                return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(
                    2,
                    "0"
                )}`;
            });

        const investedData = history
            .filter((_, index) => index % 6 === 0)
            .map((item) => item.totalInvested);

        const valueData = history
            .filter((_, index) => index % 6 === 0)
            .map((item) => item.currentValue);

        return {
            labels,
            datasets: [
                {
                    label: "累計投資額",
                    data: investedData,
                    borderColor: "#FF6B6B",
                    backgroundColor: "rgba(255, 107, 107, 0.1)",
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                },
                {
                    label: "評価額",
                    data: valueData,
                    borderColor: "#4ECDC4",
                    backgroundColor: "rgba(78, 205, 196, 0.18)",
                    borderWidth: 3,
                    fill: true,
                    tension: 0.35
                }
            ]
        };
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            title: {
                display: true,
                text:
                    investmentType === "lump"
                        ? "一括投資シミュレーション"
                        : "積立投資シミュレーション",
                font: { size: 16, weight: "bold" },
                padding: 16
            },
            legend: {
                position: "top",
                labels: { usePointStyle: true, padding: 16 }
            },
            tooltip: {
                mode: "index",
                intersect: false,
                callbacks: {
                    label(context) {
                        return `${context.dataset.label}: ¥${context.parsed.y.toLocaleString()}`;
                    }
                }
            }
        },
        scales: {
            x: {
                title: { display: true, text: "期間" },
                grid: { color: "rgba(0, 0, 0, 0.08)" }
            },
            y: {
                title: { display: true, text: "金額 (JPY)" },
                grid: { color: "rgba(0, 0, 0, 0.08)" },
                ticks: {
                    callback(value) {
                        return `¥${value.toLocaleString()}`;
                    }
                }
            }
        }
    };

    if (!stockData || !stockData["Monthly Time Series"]) {
        return (
            <div className={styles.stateCard}>
                <span className={styles.stateIcon}>📊</span>
                <p>株価データを読み込み中です...</p>
            </div>
        );
    }

    const monthlyBudget =
        yearsAgo > 0 ? Math.round(investmentAmount / (yearsAgo * 12)) : 0;

    return (
        <div className={styles.container}>
            <div className={styles.controlCard}>
                {showTitle && <h3 className={styles.sectionTitle}>🚀 仮想投資シミュレーター</h3>}

                <div className={styles.toggleGroup}>
                    <button
                        type="button"
                        className={`${styles.toggleButton} ${
                            investmentType === "lump" ? styles.activeToggle : ""
                        }`}
                        onClick={() => setInvestmentType("lump")}
                    >
                        💰 一括投資
                    </button>
                    <button
                        type="button"
                        className={`${styles.toggleButton} ${
                            investmentType === "monthly" ? styles.activeToggle : ""
                        }`}
                        onClick={() => setInvestmentType("monthly")}
                    >
                        📈 積立投資
                    </button>
                </div>

                <div className={styles.sliderGroup}>
                    <label className={styles.sliderLabel}>
                        {investmentType === "lump" ? "投資金額" : "総投資予算"}:
                        ¥{investmentAmount.toLocaleString()}
                        {investmentType === "monthly" && (
                            <span className={styles.sliderAnnotation}>
                                (月額: ¥{monthlyBudget.toLocaleString()})
                            </span>
                        )}
                    </label>
                    <input
                        type="range"
                        min="100000"
                        max="10000000"
                        step="100000"
                        value={investmentAmount}
                        onChange={(e) => setInvestmentAmount(parseInt(e.target.value, 10))}
                        className={styles.range}
                    />
                    <div className={styles.sliderScale}>
                        <span>¥10万</span>
                        <span>¥1,000万</span>
                    </div>
                </div>

                <div className={styles.sliderGroup}>
                    <label className={styles.sliderLabel}>
                        投資期間: {yearsAgo}年前から現在まで
                    </label>
                    <input
                        type="range"
                        min="1"
                        max="20"
                        step="1"
                        value={yearsAgo}
                        onChange={(e) => setYearsAgo(parseInt(e.target.value, 10))}
                        className={styles.range}
                    />
                    <div className={styles.sliderScale}>
                        <span>1年前</span>
                        <span>20年前</span>
                    </div>
                </div>
            </div>

            {simulationResult && (
                <>
                    <div className={styles.metricsGrid}>
                        <div className={styles.metricCard}>
                            <div className={styles.metricLabel}>投資元本</div>
                            <div className={styles.metricValue}>
                                ¥{simulationResult.investedAmount.toLocaleString()}
                            </div>
                        </div>
                        <div className={styles.metricCard}>
                            <div className={styles.metricLabel}>現在の価値</div>
                            <div className={`${styles.metricValue} ${styles.metricPositive}`}>
                                ¥{simulationResult.currentValue.toLocaleString()}
                            </div>
                        </div>
                        <div className={styles.metricCard}>
                            <div className={styles.metricLabel}>損益</div>
                            <div
                                className={`${styles.metricValue} ${
                                    simulationResult.profit >= 0
                                        ? styles.metricPositive
                                        : styles.metricNegative
                                }`}
                            >
                                {simulationResult.profit >= 0 ? "+" : ""}
                                ¥{simulationResult.profit.toLocaleString()}
                            </div>
                        </div>
                        <div className={styles.metricCard}>
                            <div className={styles.metricLabel}>年平均リターン</div>
                            <div
                                className={`${styles.metricValue} ${
                                    simulationResult.annualReturn >= 0
                                        ? styles.metricPositive
                                        : styles.metricNegative
                                }`}
                            >
                                {simulationResult.annualReturn >= 0 ? "+" : ""}
                                {simulationResult.annualReturn.toFixed(1)}%
                            </div>
                        </div>
                    </div>

                    <div className={styles.chartCard}>
                        <Line data={simulationResult.chartData} options={chartOptions} />
                    </div>
                </>
            )}
        </div>
    );
};

export default VirtualInvestmentSimulator;
