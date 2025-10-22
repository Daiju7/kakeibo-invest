/**
 * 🚀 VirtualInvestmentSimulator.js - 仮想投資シミュレーターコンポーネント
 * 
 * 【コンポーネントの役割】
 * - 任意の投資額と期間を設定して「もしも投資していたら」のシミュレーションを実行
 * - 一括投資と積立投資の2つのパターンをサポート
 * - リアルタイムでの計算結果更新とグラフ表示
 * - インタラクティブなスライダーUIによる直感的操作
 * 
 * 【主要機能】
 * 1. 投資パターン選択 (一括 vs 積立)
 * 2. 投資額調整スライダー (10万円〜1,000万円)
 * 3. 期間調整スライダー (1年前〜20年前)
 * 4. リアルタイム投資成果計算
 * 5. Chart.jsによるグラフ表示
 * 6. 年平均リターン・損益の表示
 * 
 * 【計算ロジック】
 * - 一括投資: 指定時点で一度に投資した場合の成果
 * - 積立投資: 総額を期間で割って毎月定額投資した場合の成果
 */

import React, { useState, useEffect } from "react";
// Chart.jsライブラリのインポート - グラフ描画用
import {
    Chart as ChartJS,
    CategoryScale,    // X軸 (カテゴリ軸) 
    LinearScale,      // Y軸 (数値軸)
    PointElement,     // 点の描画
    LineElement,      // 線の描画
    BarElement,       // 棒グラフ (将来使用可能性)
    Title,            // チャートタイトル
    Tooltip,          // ホバー時の詳細表示
    Legend,           // 凡例
    Filler           // エリア塗りつぶし
} from "chart.js";
import { Line } from "react-chartjs-2"; // 線グラフコンポーネント

// Chart.jsプラグインの登録 (使用する機能を明示的に登録)
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

const VirtualInvestmentSimulator = ({ stockData }) => {
    // 【状態管理】React Hooksによるコンポーネント状態
    const [investmentAmount, setInvestmentAmount] = useState(1000000); // 投資額 (初期値: 100万円)
    const [yearsAgo, setYearsAgo] = useState(5);                      // 投資期間 (初期値: 5年前)
    const [investmentType, setInvestmentType] = useState('lump');      // 投資タイプ ('lump': 一括, 'monthly': 積立)
    const [simulationResult, setSimulationResult] = useState(null);   // 計算結果格納

    // 【副作用フック】パラメータ変更時の自動再計算
    // 依存配列: investmentAmount, yearsAgo, investmentType, stockData
    // いずれかが変更されると calculateSimulation() が実行される
    useEffect(() => {
        if (stockData && stockData["Monthly Time Series"]) {
            calculateSimulation();
        }
    }, [investmentAmount, yearsAgo, investmentType, stockData]);

    /**
     * 【メイン計算関数】投資シミュレーションの実行
     * 一括投資と積立投資の両パターンに対応
     */
    const calculateSimulation = () => {
        // 株価データの存在確認
        if (!stockData || !stockData["Monthly Time Series"]) return;

        // 【STEP 1】株価データの前処理
        const timeSeries = stockData["Monthly Time Series"];
        // APIレスポンスから株価データを配列に変換・ソート
        const sortedData = Object.entries(timeSeries)
            .map(([date, values]) => ({
                date: date,
                price: parseFloat(values["4. close"]) // 終値を使用
            }))
            .sort((a, b) => new Date(a.date) - new Date(b.date)); // 日付昇順

        if (sortedData.length === 0) return;

        // 【STEP 2】投資開始日の特定
        const currentDate = new Date();
        const targetDate = new Date(currentDate.getFullYear() - yearsAgo, currentDate.getMonth(), 1);
        
        // 投資開始時点の株価を取得 (指定年月以降の最初のデータ)
        const startPoint = sortedData.find(item => new Date(item.date) >= targetDate) || sortedData[0];
        const currentPoint = sortedData[sortedData.length - 1]; // 最新の株価
        
        let result = {}; // 計算結果を格納するオブジェクト

        if (investmentType === 'lump') {
            // 【パターン1】一括投資の計算
            
            // 購入可能株数 = 投資額 ÷ 開始時点の株価
            const shares = investmentAmount / startPoint.price;
            
            // 現在の評価額 = 株数 × 現在の株価
            const currentValue = shares * currentPoint.price;
            
            // 損益計算
            const profit = currentValue - investmentAmount;                    // 絶対額
            const profitPercent = (profit / investmentAmount) * 100;          // パーセンテージ
            const annualReturn = Math.pow(currentValue / investmentAmount, 1 / yearsAgo) - 1; // 年平均リターン

            result = {
                type: 'lump',
                startDate: startPoint.date,
                startPrice: startPoint.price,
                currentPrice: currentPoint.price,
                shares: shares,
                investedAmount: investmentAmount,
                currentValue: currentValue,
                profit: profit,
                profitPercent: profitPercent,
                annualReturn: annualReturn * 100,
                chartData: generateLumpSumChart(sortedData, startPoint, investmentAmount, yearsAgo)
            };
            
        } else {
            // 【パターン2】積立投資の計算
            
            const monthlyAmount = investmentAmount / (yearsAgo * 12); // 月額投資額
            let totalShares = 0;     // 累積保有株数
            let totalInvested = 0;   // 累積投資額
            const investmentHistory = []; // 月別投資履歴

            // 投資開始日から現在まで毎月投資をシミュレート
            const relevantData = sortedData.filter(item => new Date(item.date) >= new Date(startPoint.date));
            
            for (let i = 0; i < relevantData.length && i < yearsAgo * 12; i++) {
                const monthData = relevantData[i];
                
                // その月の購入株数 = 月額投資額 ÷ その月の株価
                const shares = monthlyAmount / monthData.price;
                totalShares += shares;
                totalInvested += monthlyAmount;
                
                // その時点での評価額
                const currentValue = totalShares * currentPoint.price;
                
                // 月別履歴を記録
                investmentHistory.push({
                    date: monthData.date,
                    monthlyInvestment: monthlyAmount,
                    totalInvested: totalInvested,
                    shares: totalShares,
                    currentValue: currentValue,
                    profit: currentValue - totalInvested
                });
            }

            // 最終結果の計算
            const finalCurrentValue = totalShares * currentPoint.price;
            const finalProfit = finalCurrentValue - totalInvested;
            const finalProfitPercent = totalInvested > 0 ? (finalProfit / totalInvested) * 100 : 0;
            const annualReturn = totalInvested > 0 ? Math.pow(finalCurrentValue / totalInvested, 1 / yearsAgo) - 1 : 0;

            result = {
                type: 'monthly',
                startDate: startPoint.date,
                monthlyAmount: monthlyAmount,
                totalMonths: Math.min(relevantData.length, yearsAgo * 12),
                shares: totalShares,
                investedAmount: totalInvested,
                currentValue: finalCurrentValue,
                profit: finalProfit,
                profitPercent: finalProfitPercent,
                annualReturn: annualReturn * 100,
                investmentHistory: investmentHistory,
                chartData: generateMonthlyChart(investmentHistory)
            };
        }

        // 計算結果を状態に保存 (UIの再レンダリングを トリガー)
        setSimulationResult(result);
    };

    /**
     * 【一括投資用チャートデータ生成】
     * 投資元本 (固定線) vs 評価額 (変動線) の比較チャート
     */
    const generateLumpSumChart = (sortedData, startPoint, amount, years) => {
        const startIndex = sortedData.findIndex(item => item.date === startPoint.date);
        const relevantData = sortedData.slice(startIndex); // 投資開始以降のデータ
        const shares = amount / startPoint.price;          // 購入株数

        // 表示用ラベル (3ヶ月おきに間引いて見やすく)
        const labels = relevantData
            .filter((_, index) => index % 3 === 0)
            .map(item => {
                const date = new Date(item.date);
                return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}`;
            });

        // 評価額データ (株数 × その時点の株価)
        const valueData = relevantData
            .filter((_, index) => index % 3 === 0)
            .map(item => shares * item.price);

        return {
            labels: labels,
            datasets: [
                {
                    label: '投資元本',
                    data: new Array(labels.length).fill(amount), // 固定値の配列
                    borderColor: '#FF6B6B',
                    backgroundColor: 'rgba(255, 107, 107, 0.1)',
                    borderWidth: 2,
                    borderDash: [5, 5], // 破線スタイル
                    fill: false,
                },
                {
                    label: '評価額',
                    data: valueData,
                    borderColor: '#4ECDC4',
                    backgroundColor: 'rgba(78, 205, 196, 0.2)',
                    borderWidth: 3,
                    fill: true,    // エリア塗りつぶし
                    tension: 0.4,  // 曲線の滑らかさ
                }
            ]
        };
    };

    /**
     * 【積立投資用チャートデータ生成】
     * 累積投資額 vs 評価額の成長比較チャート
     */
    const generateMonthlyChart = (history) => {
        // 表示用ラベル (6ヶ月おきに間引き)
        const labels = history
            .filter((_, index) => index % 6 === 0)
            .map(item => {
                const date = new Date(item.date);
                return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}`;
            });

        // 累積投資額データ
        const investedData = history
            .filter((_, index) => index % 6 === 0)
            .map(item => item.totalInvested);

        // 評価額データ
        const valueData = history
            .filter((_, index) => index % 6 === 0)
            .map(item => item.currentValue);

        return {
            labels: labels,
            datasets: [
                {
                    label: '累計投資額',
                    data: investedData,
                    borderColor: '#FF6B6B',
                    backgroundColor: 'rgba(255, 107, 107, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                },
                {
                    label: '評価額',
                    data: valueData,
                    borderColor: '#4ECDC4',
                    backgroundColor: 'rgba(78, 205, 196, 0.2)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                }
            ]
        };
    };

    /**
     * 【チャート共通設定】Chart.jsのオプション設定
     */
    const chartOptions = {
        responsive: true,              // レスポンシブ対応
        maintainAspectRatio: false,    // アスペクト比固定を無効化
        plugins: {
            title: {
                display: true,
                text: `${investmentType === 'lump' ? '一括投資' : '積立投資'}シミュレーション`,
                font: { size: 16, weight: 'bold' },
                padding: 20
            },
            legend: {
                position: 'top',
                labels: { usePointStyle: true, padding: 15 }
            },
            tooltip: {
                mode: 'index',        // X軸位置での全データ表示
                intersect: false,     // 線上でなくてもツールチップ表示
                callbacks: {
                    label: function(context) {
                        return `${context.dataset.label}: ¥${context.parsed.y.toLocaleString()}`;
                    }
                }
            }
        },
        scales: {
            x: {
                title: { display: true, text: '期間' }
            },
            y: {
                title: { display: true, text: '金額 (JPY)' },
                ticks: {
                    callback: function(value) {
                        return '¥' + value.toLocaleString(); // 数値を通貨形式でフォーマット
                    }
                }
            }
        }
    };

    // 【早期リターン】株価データ未取得時の表示
    if (!stockData || !stockData["Monthly Time Series"]) {
        return (
            <div style={{
                textAlign: 'center',
                padding: '2rem',
                background: '#f8f9fa',
                borderRadius: '12px'
            }}>
                <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📊</div>
                <p>株価データを読み込み中...</p>
            </div>
        );
    }

    // 【メインレンダリング】コンポーネントのJSX構造
    return (
        <div style={{ width: '100%', marginTop: '2rem' }}>
            {/* 【セクション1】コントロールパネル - ユーザー入力UI */}
            <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '2rem',
                boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
                marginBottom: '2rem'
            }}>
                <h3 style={{
                    marginBottom: '2rem',
                    textAlign: 'center',
                    color: '#333',
                    fontSize: '1.5rem'
                }}>
                    🚀 仮想投資シミュレーター
                </h3>

                {/* 【UI要素1】投資タイプ選択ボタン */}
                <div style={{ marginBottom: '2rem' }}>
                    <label style={{ display: 'block', marginBottom: '1rem', fontWeight: 'bold' }}>
                        投資パターン:
                    </label>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        {/* 一括投資ボタン */}
                        <button
                            onClick={() => setInvestmentType('lump')} // 状態更新→useEffect→再計算
                            style={{
                                padding: '0.75rem 1.5rem',
                                borderRadius: '25px',
                                border: 'none',
                                // 選択状態に応じて背景色を動的変更
                                background: investmentType === 'lump' ? 
                                    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#f8f9fa',
                                color: investmentType === 'lump' ? 'white' : '#333',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease' // スムーズなアニメーション
                            }}
                        >
                            💰 一括投資
                        </button>
                        {/* 積立投資ボタン */}
                        <button
                            onClick={() => setInvestmentType('monthly')}
                            style={{
                                padding: '0.75rem 1.5rem',
                                borderRadius: '25px',
                                border: 'none',
                                background: investmentType === 'monthly' ? 
                                    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#f8f9fa',
                                color: investmentType === 'monthly' ? 'white' : '#333',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease'
                            }}
                        >
                            📈 積立投資
                        </button>
                    </div>
                </div>

                {/* 【UI要素2】投資額調整スライダー */}
                <div style={{ marginBottom: '2rem' }}>
                    <label style={{ display: 'block', marginBottom: '1rem', fontWeight: 'bold' }}>
                        {/* ラベルを投資タイプに応じて動的変更 */}
                        {investmentType === 'lump' ? '投資金額:' : '総投資予算:'} ¥{investmentAmount.toLocaleString()}
                        {/* 積立投資の場合は月額も表示 */}
                        {investmentType === 'monthly' && (
                            <span style={{ fontSize: '0.9rem', color: '#666', marginLeft: '1rem' }}>
                                (月額: ¥{Math.round(investmentAmount / (yearsAgo * 12)).toLocaleString()})
                            </span>
                        )}
                    </label>
                    {/* HTML5 range input - 10万円〜1,000万円の範囲 */}
                    <input
                        type="range"
                        min="100000"    // 最小値: 10万円
                        max="10000000"  // 最大値: 1,000万円
                        step="100000"   // 刻み: 10万円単位
                        value={investmentAmount}
                        onChange={(e) => setInvestmentAmount(parseInt(e.target.value))} // 文字列→数値変換
                        style={{
                            width: '100%',
                            height: '8px',
                            borderRadius: '5px',
                            background: 'linear-gradient(to right, #667eea, #764ba2)', // グラデーション背景
                            outline: 'none',
                            appearance: 'none' // ブラウザデフォルトスタイルを無効化
                        }}
                    />
                    {/* スライダーの範囲表示 */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#666' }}>
                        <span>¥10万</span>
                        <span>¥1,000万</span>
                    </div>
                </div>

                {/* 【UI要素3】期間調整スライダー */}
                <div style={{ marginBottom: '2rem' }}>
                    <label style={{ display: 'block', marginBottom: '1rem', fontWeight: 'bold' }}>
                        投資期間: {yearsAgo}年前から現在まで
                    </label>
                    <input
                        type="range"
                        min="1"         // 最小: 1年前
                        max="20"        // 最大: 20年前
                        step="1"        // 刻み: 1年単位
                        value={yearsAgo}
                        onChange={(e) => setYearsAgo(parseInt(e.target.value))}
                        style={{
                            width: '100%',
                            height: '8px',
                            borderRadius: '5px',
                            background: 'linear-gradient(to right, #4ECDC4, #44A08D)',
                            outline: 'none',
                            appearance: 'none'
                        }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#666' }}>
                        <span>1年前</span>
                        <span>20年前</span>
                    </div>
                </div>
            </div>

            {/* 【セクション2】結果表示エリア */}
            {simulationResult && (
                <>
                    {/* 【サブセクション2-1】サマリーカード群 */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', // レスポンシブグリッド
                        gap: '1rem',
                        marginBottom: '2rem'
                    }}>
                        {/* 投資元本カード */}
                        <div style={{
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: 'white',
                            padding: '1.5rem',
                            borderRadius: '12px',
                            textAlign: 'center'
                        }}>
                            <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>投資元本</div>
                            <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>
                                ¥{simulationResult.investedAmount.toLocaleString()}
                            </div>
                        </div>

                        {/* 現在価値カード */}
                        <div style={{
                            background: 'linear-gradient(135deg, #4ECDC4 0%, #44A08D 100%)',
                            color: 'white',
                            padding: '1.5rem',
                            borderRadius: '12px',
                            textAlign: 'center'
                        }}>
                            <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>現在の価値</div>
                            <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>
                                ¥{simulationResult.currentValue.toLocaleString()}
                            </div>
                        </div>

                        {/* 損益カード - 利益/損失に応じて色を動的変更 */}
                        <div style={{
                            background: simulationResult.profit >= 0 ? 
                                'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' :  // 利益: 緑系
                                'linear-gradient(135deg, #fc4a1a 0%, #f7b733 100%)',   // 損失: 赤系
                            color: 'white',
                            padding: '1.5rem',
                            borderRadius: '12px',
                            textAlign: 'center'
                        }}>
                            <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>損益</div>
                            <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>
                                {/* 利益の場合は + 記号を表示 */}
                                {simulationResult.profit >= 0 ? '+' : ''}¥{simulationResult.profit.toLocaleString()}
                            </div>
                        </div>

                        {/* 年平均リターンカード */}
                        <div style={{
                            background: simulationResult.annualReturn >= 0 ? 
                                'linear-gradient(135deg, #43cea2 0%, #185a9d 100%)' : 
                                'linear-gradient(135deg, #d53369 0%, #daae51 100%)',
                            color: 'white',
                            padding: '1.5rem',
                            borderRadius: '12px',
                            textAlign: 'center'
                        }}>
                            <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>年平均リターン</div>
                            <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>
                                {simulationResult.annualReturn >= 0 ? '+' : ''}{simulationResult.annualReturn.toFixed(1)}%
                            </div>
                        </div>
                    </div>

                    {/* 【サブセクション2-2】グラフ表示エリア */}
                    <div style={{ 
                        height: '400px',  // 固定高さ
                        background: 'white',
                        borderRadius: '12px',
                        padding: '1rem',
                        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)'
                    }}>
                        {/* Chart.js Lineコンポーネント */}
                        <Line data={simulationResult.chartData} options={chartOptions} />
                    </div>
                </>
            )}
        </div>
    );
};

export default VirtualInvestmentSimulator;