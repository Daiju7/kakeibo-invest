import React from "react";
import{Chart as ChartJS,ArcElement,Tooltip,Legend,Title}from"chart.js";
import{Pie}from"react-chartjs-2";

ChartJS.register(ArcElement,Tooltip,Legend,Title);

const CycleChart=({data})=>{

  // page.jsから渡されたデータを基に、カテゴリーごと円グラフを作成
    
//page.jsで既にカテゴリ毎の合計金額を計算しているので、それを利用する
//page.jsからどうやって持ってきているのかというと、CycleChartコンポーネントのpropsとしてdataを渡している。
// propsを使うことで、親コンポーネント（page.js）から子コンポーネント（CycleChart.js）にデータを渡すことができる。
const categoryTotals = {
    food: data.filter(item => item.category === 'food').reduce((sum, item) => sum + parseInt(item.amount), 0),
    transport: data.filter(item => item.category === 'transport').reduce((sum, item) => sum + parseInt(item.amount), 0),
    clothing: data.filter(item => item.category === 'clothing').reduce((sum, item) => sum + parseInt(item.amount), 0),
    entertainment: data.filter(item => item.category === 'entertainment').reduce((sum, item) => sum + parseInt(item.amount), 0),
    investment: data.filter(item => item.category === 'investment').reduce((sum, item) => sum + parseInt(item.amount), 0),
    others: data.filter(item => item.category === 'others').reduce((sum, item) => sum + parseInt(item.amount), 0),
};

const chartData = {
    labels: ['食費', '交通費', '衣服・美容費', '娯楽費', '投資', 'その他'],
    datasets: [{
        data: [
            categoryTotals.food,
            categoryTotals.transport,
            categoryTotals.clothing,
            categoryTotals.entertainment,
            categoryTotals.investment,
            categoryTotals.others
        ],
        backgroundColor: [
            '#ffeaa7',
            '#74b9ff',
            '#fd79a8',
            '#fdcb6e',
            '#00b894',
            '#a29bfe'
        ],
        hoverOffset: 30
    }]
};

const options = {
    responsive: true,
    plugins: {
        title: {
            display: true,
            text: 'カテゴリー別支出割合',
            font: {
                size: 18
            }
        },
        legend: {
            position: 'bottom'
        }
    }
};

    return <Pie data={chartData} options={options} />;
};

export default CycleChart;  
//CycleChart.jsでは、page.jsから渡されたデータを基に、カテゴリーごとの合計金額を計算し、それを使って円グラフを作成しています。