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

const InvestmentSimulation = ({ stockData, expenseData }) => {
    if (!stockData || !expenseData || !stockData["Monthly Time Series"] || !expenseData.monthlyData) {
        return (
            <div style={{
                textAlign: 'center',
                padding: '2rem',
                background: '#f8f9fa',
                borderRadius: '12px',
                margin: '2rem 0'
            }}>
                <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📊</div>
                <p>投資シミュレーションには株価データと家計簿データの両方が必要です</p>
            </div>
        );
    }

    // 株価データを準備
    const stockTimeSeries = stockData["Monthly Time Series"];
    const stockPrices = Object.entries(stockTimeSeries)
        .map(([date, values]) => ({
            date: date,
            price: parseFloat(values["4. close"])
        }))
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    // 投資データを準備
    const investmentsByMonth = expenseData.monthlyData.reduce((acc, monthData) => {
        acc[monthData.month] = monthData.totalAmount;
        return acc;
    }, {});

    // シミュレーション計算
    const simulationData = [];
    let totalInvested = 0;
    let totalShares = 0;

    stockPrices.forEach((stockPoint, index) => {
        const monthKey = stockPoint.date.substring(0, 7); // YYYY-MM形式
        const monthlyInvestment = investmentsByMonth[monthKey] || 0;
        
        if (monthlyInvestment > 0) {
            // その月の投資額で株を購入
            const sharesCanBuy = monthlyInvestment / stockPoint.price;
            totalShares += sharesCanBuy;
            totalInvested += monthlyInvestment;
        }
        
        // 現在の評価額を計算
        const currentValue = totalShares * stockPoint.price;
        const profit = currentValue - totalInvested;
        const profitPercent = totalInvested > 0 ? (profit / totalInvested) * 100 : 0;
        
        simulationData.push({
            date: stockPoint.date,
            month: monthKey,
            stockPrice: stockPoint.price,
            monthlyInvestment: monthlyInvestment,
            totalInvested: totalInvested,
            currentValue: currentValue,
            profit: profit,
            profitPercent: profitPercent,
            shares: totalShares
        });
    });

    // チャート用データを準備
    const labels = simulationData
        .filter((_, index) => index % 2 === 0) // 2ヶ月おきに表示してラベルを見やすく
        .map(item => {
            const date = new Date(item.date);
            return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}`;
        });

    const chartData = {
        labels: labels,
        datasets: [
            {
                label: '投資元本',
                data: simulationData
                    .filter((_, index) => index % 2 === 0)
                    .map(item => item.totalInvested),
                borderColor: '#FF6B6B',
                backgroundColor: 'rgba(255, 107, 107, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#FF6B6B',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 4,
            },
            {
                label: '評価額',
                data: simulationData
                    .filter((_, index) => index % 2 === 0)
                    .map(item => item.currentValue),
                borderColor: '#4ECDC4',
                backgroundColor: 'rgba(78, 205, 196, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#4ECDC4',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 4,
            }
        ]
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            title: {
                display: true,
                text: '💰 S&P500投資シミュレーション（家計簿データ基準）',
                font: {
                    size: 20,
                    weight: 'bold'
                },
                padding: 20
            },
            legend: {
                position: 'top',
                labels: {
                    usePointStyle: true,
                    padding: 20,
                    font: {
                        size: 14
                    }
                }
            },
            tooltip: {
                mode: 'index',
                intersect: false,
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                titleColor: '#ffffff',
                bodyColor: '#ffffff',
                borderColor: '#ffffff',
                borderWidth: 1,
                callbacks: {
                    label: function(context) {
                        const value = context.parsed.y;
                        return `${context.dataset.label}: ¥${value.toLocaleString()}`;
                    }
                }
            }
        },
        scales: {
            x: {
                display: true,
                title: {
                    display: true,
                    text: '年月',
                    font: {
                        size: 14,
                        weight: 'bold'
                    }
                },
                grid: {
                    color: 'rgba(0, 0, 0, 0.1)'
                }
            },
            y: {
                display: true,
                title: {
                    display: true,
                    text: '金額 (JPY)',
                    font: {
                        size: 14,
                        weight: 'bold'
                    }
                },
                grid: {
                    color: 'rgba(0, 0, 0, 0.1)'
                },
                ticks: {
                    callback: function(value) {
                        return '¥' + value.toLocaleString();
                    }
                }
            }
        },
        interaction: {
            mode: 'nearest',
            axis: 'x',
            intersect: false
        }
    };

    // 最新の状況
    const latestData = simulationData[simulationData.length - 1];
    const totalProfitPercent = latestData ? latestData.profitPercent : 0;
    const totalProfit = latestData ? latestData.profit : 0;
    const finalValue = latestData ? latestData.currentValue : 0;
    const totalInvestmentAmount = latestData ? latestData.totalInvested : 0;

    return (
        <div style={{ width: '100%', marginTop: '2rem' }}>
            {/* シミュレーション結果サマリー */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem',
                marginBottom: '2rem'
            }}>
                <div style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    padding: '1.5rem',
                    borderRadius: '12px',
                    textAlign: 'center',
                    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)'
                }}>
                    <div style={{ fontSize: '0.9rem', opacity: 0.9, marginBottom: '0.5rem' }}>
                        総投資額
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>
                        ¥{totalInvestmentAmount.toLocaleString()}
                    </div>
                </div>
                
                <div style={{
                    background: 'linear-gradient(135deg, #4ECDC4 0%, #44A08D 100%)',
                    color: 'white',
                    padding: '1.5rem',
                    borderRadius: '12px',
                    textAlign: 'center',
                    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)'
                }}>
                    <div style={{ fontSize: '0.9rem', opacity: 0.9, marginBottom: '0.5rem' }}>
                        現在の評価額
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>
                        ¥{finalValue.toLocaleString()}
                    </div>
                </div>
                
                <div style={{
                    background: totalProfit >= 0 ? 
                        'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' : 
                        'linear-gradient(135deg, #fc4a1a 0%, #f7b733 100%)',
                    color: 'white',
                    padding: '1.5rem',
                    borderRadius: '12px',
                    textAlign: 'center',
                    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)'
                }}>
                    <div style={{ fontSize: '0.9rem', opacity: 0.9, marginBottom: '0.5rem' }}>
                        損益
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>
                        {totalProfit >= 0 ? '+' : ''}¥{totalProfit.toLocaleString()}
                    </div>
                </div>
                
                <div style={{
                    background: totalProfitPercent >= 0 ? 
                        'linear-gradient(135deg, #43cea2 0%, #185a9d 100%)' : 
                        'linear-gradient(135deg, #d53369 0%, #daae51 100%)',
                    color: 'white',
                    padding: '1.5rem',
                    borderRadius: '12px',
                    textAlign: 'center',
                    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)'
                }}>
                    <div style={{ fontSize: '0.9rem', opacity: 0.9, marginBottom: '0.5rem' }}>
                        利回り
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>
                        {totalProfitPercent >= 0 ? '+' : ''}{totalProfitPercent.toFixed(1)}%
                    </div>
                </div>
            </div>

            {/* チャート */}
            <div style={{ 
                height: '500px', 
                background: 'white',
                borderRadius: '12px',
                padding: '1rem',
                boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
                marginBottom: '2rem'
            }}>
                <Line data={chartData} options={options} />
            </div>

            {/* 詳細情報 */}
            <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '1.5rem',
                boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)'
            }}>
                <h3 style={{ 
                    marginBottom: '1rem',
                    color: '#333',
                    borderBottom: '2px solid #4ECDC4',
                    paddingBottom: '0.5rem'
                }}>
                    📈 投資シミュレーション詳細
                </h3>
                
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                    gap: '1rem'
                }}>
                    <div style={{
                        background: '#f8f9fa',
                        padding: '1rem',
                        borderRadius: '8px',
                        border: '2px solid #e9ecef'
                    }}>
                        <h4 style={{ color: '#666', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                            保有株数
                        </h4>
                        <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#007bff' }}>
                            {latestData ? latestData.shares.toFixed(4) : 0} 株
                        </div>
                    </div>
                    
                    <div style={{
                        background: '#f8f9fa',
                        padding: '1rem',
                        borderRadius: '8px',
                        border: '2px solid #e9ecef'
                    }}>
                        <h4 style={{ color: '#666', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                            投資回数
                        </h4>
                        <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#28a745' }}>
                            {expenseData.monthlyData.length} 回
                        </div>
                    </div>
                    
                    <div style={{
                        background: '#f8f9fa',
                        padding: '1rem',
                        borderRadius: '8px',
                        border: '2px solid #e9ecef'
                    }}>
                        <h4 style={{ color: '#666', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                            平均投資額/月
                        </h4>
                        <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#ffc107' }}>
                            ¥{expenseData.monthlyData.length > 0 ? 
                                Math.round(expenseData.totalAmount / expenseData.monthlyData.length).toLocaleString() : 0}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InvestmentSimulation;