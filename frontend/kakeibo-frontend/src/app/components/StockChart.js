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

const StockChart = ({ stockData }) => {
    if (!stockData || (!stockData["Time Series (Daily)"] && !stockData["Monthly Time Series"])) {
        return null;
    }

    // 月次データまたは日次データを判定
    const timeSeries = stockData["Monthly Time Series"] || stockData["Time Series (Daily)"];
    const isMonthlyData = !!stockData["Monthly Time Series"];
    
    // 株価データを配列に変換し、日付順にソート
    const sortedData = Object.entries(timeSeries)
        .map(([date, values]) => ({
            date: date,
            close: parseFloat(values["4. close"]),
            open: parseFloat(values["1. open"]),
            high: parseFloat(values["2. high"]),
            low: parseFloat(values["3. low"])
        }))
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(isMonthlyData ? -24 : -30); // 月次なら24ヶ月、日次なら30日

    const labels = sortedData.map(item => {
        const date = new Date(item.date);
        if (isMonthlyData) {
            return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}`;
        } else {
            return `${date.getMonth() + 1}/${date.getDate()}`;
        }
    });

    const chartData = {
        labels: labels,
        datasets: [
            {
                label: '終値 (Close)',
                data: sortedData.map(item => item.close),
                borderColor: '#2196F3',
                backgroundColor: 'rgba(33, 150, 243, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#2196F3',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6,
            },
            {
                label: '始値 (Open)',
                data: sortedData.map(item => item.open),
                borderColor: '#FF9800',
                backgroundColor: 'rgba(255, 152, 0, 0.1)',
                borderWidth: 2,
                fill: false,
                tension: 0.4,
                pointBackgroundColor: '#FF9800',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 3,
                pointHoverRadius: 5,
            }
        ]
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            title: {
                display: true,
                text: `S&P 500 株価推移（過去${isMonthlyData ? '24ヶ月' : '30日'}）`,
                font: {
                    size: 18,
                    weight: 'bold'
                },
                padding: 20
            },
            legend: {
                position: 'top',
                labels: {
                    usePointStyle: true,
                    padding: 20
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
                    text: isMonthlyData ? '年月' : '日付',
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
                    text: '株価 (USD)',
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
                        return '$' + value.toFixed(0);
                    }
                }
            }
        },
        interaction: {
            mode: 'nearest',
            axis: 'x',
            intersect: false
        },
        elements: {
            point: {
                hoverBackgroundColor: '#ffffff'
            }
        }
    };

    // 最新の株価情報を取得
    const latestData = sortedData[sortedData.length - 1];
    const previousData = sortedData[sortedData.length - 2];
    const priceChange = latestData && previousData ? 
        (latestData.close - previousData.close).toFixed(2) : 0;
    const priceChangePercent = latestData && previousData ? 
        (((latestData.close - previousData.close) / previousData.close) * 100).toFixed(2) : 0;

    return (
        <div style={{ width: '100%', marginTop: '2rem' }}>
            {/* 株価サマリー */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-around',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                padding: '1.5rem',
                borderRadius: '12px',
                marginBottom: '2rem',
                boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>現在値</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>
                        ${latestData?.close.toFixed(2)}
                    </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>前日比</div>
                    <div style={{ 
                        fontSize: '1.4rem', 
                        fontWeight: 'bold',
                        color: priceChange >= 0 ? '#4CAF50' : '#F44336'
                    }}>
                        {priceChange >= 0 ? '+' : ''}${priceChange}
                    </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>変動率</div>
                    <div style={{ 
                        fontSize: '1.4rem', 
                        fontWeight: 'bold',
                        color: priceChangePercent >= 0 ? '#4CAF50' : '#F44336'
                    }}>
                        {priceChangePercent >= 0 ? '+' : ''}{priceChangePercent}%
                    </div>
                </div>
            </div>

            {/* チャート */}
            <div style={{ 
                height: '400px', 
                background: 'white',
                borderRadius: '12px',
                padding: '1rem',
                boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)'
            }}>
                <Line data={chartData} options={options} />
            </div>

            {/* 統計情報 */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '1rem',
                marginTop: '2rem'
            }}>
                <div style={{
                    background: '#f8f9fa',
                    padding: '1rem',
                    borderRadius: '8px',
                    textAlign: 'center',
                    border: '2px solid #e9ecef'
                }}>
                    <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem' }}>
                        最高値
                    </div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#28a745' }}>
                        ${Math.max(...sortedData.map(d => d.high)).toFixed(2)}
                    </div>
                </div>
                <div style={{
                    background: '#f8f9fa',
                    padding: '1rem',
                    borderRadius: '8px',
                    textAlign: 'center',
                    border: '2px solid #e9ecef'
                }}>
                    <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem' }}>
                        最安値
                    </div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#dc3545' }}>
                        ${Math.min(...sortedData.map(d => d.low)).toFixed(2)}
                    </div>
                </div>
                <div style={{
                    background: '#f8f9fa',
                    padding: '1rem',
                    borderRadius: '8px',
                    textAlign: 'center',
                    border: '2px solid #e9ecef'
                }}>
                    <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem' }}>
                        平均値
                    </div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#007bff' }}>
                        ${(sortedData.reduce((sum, d) => sum + d.close, 0) / sortedData.length).toFixed(2)}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StockChart;