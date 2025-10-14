"use client";
import { useEffect, useState } from "react";
import styles from './page.module.css';

export default function Home() {
  const [data, setData] = useState([]); //データベース状態管理
  const [form, setForm] = useState({ title: "", amount: "", date: "", category: "" }); //フォーム状態管理
  
  //データ取得 
  useEffect(() => {
    fetchData();
  }, []);

  //データ取得関数 （データ取得初回ロード時だけでなく、データ追加・削除後にも実行したいため、非同期処理にする）
  const fetchData = async() => {
    try {
      const response = await fetch("http://localhost:3000/api/kakeibo");
      const result = await response.json();
      setData(result);
      console.log('取得できた');
    } catch (error) {
      console.log('Error fetching data:', error);
    }
  }

  //フォーム送信関数
  const submitForm = async() => {
    try {
      const response = await fetch("http://localhost:3000/api/kakeibo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const result = await response.json();
      console.log(result);
      fetchData(); //データ再取得
    } catch (error) {
    console.log('Error submitting form:', error);
    }
  }

  //削除関数
  const deleteItem = async(id) => {
    try{
      const response = await fetch(`http://localhost:3000/api/kakeibo/${id}`, {
        method:"DELETE"
      });
      const result = await response.json();
      console.log(result);
      fetchData(); //データ再取得
    } catch (error) {
      console.log('Error deleting item:', error);
    }
  }

  // 金額の合計を計算
  const totalAmount = data.reduce((sum, item) => sum + parseInt(item.amount), 0);

  //カテゴリのラベルを定義
  const categoryLabels = {
    food: "🍽️ 食費",
    transport: "🚃 交通費", 
    beauty: "💄 衣服・美容費",
    entertainment: "🎮 娯楽費",
    investment: "💰 投資",
    other: "📦 その他"
  };

  //カテゴリーのCSSクラス名を取得
  const getCategoryClass = (category) => {
    const categoryClasses = {
      food: styles.categoryFood,
      transport: styles.categoryTransport,
      beauty: styles.categoryBeauty,
      entertainment: styles.categoryEntertainment,
      investment: styles.categoryInvestment,
      other: styles.categoryOther
    };
    return categoryClasses[category] || styles.categoryOther;
  };

  return (
    <div className={styles.container}>
      <div className={styles.wrapper}>
        {/* ヘッダー */}
        <div className={styles.header}>
          <h1 className={styles.title}>🏠 家計簿アプリ</h1>
          <p className={styles.subtitle}>毎日の収支を簡単管理</p>
          
          {/* 合計金額表示 */}
          <div className={`${styles.totalAmount} ${totalAmount >= 0 ? styles.totalPositive : styles.totalNegative}`}>
            📊 合計: ¥{totalAmount.toLocaleString()}
          </div>
        </div>

        {/* フォーム */}
        <div className={styles.formSection}>
          <h2 className={styles.formTitle}>✏️ 新しい記録を追加</h2>
          
          <form
            onSubmit={(e) => {
              e.preventDefault(); // ページリロード防止
              console.log(form);  // 今のフォームの内容を確認
              submitForm();      // フォーム送信関数を実行
              //フォームの中をリセット
              setForm({ title: "", amount: "", date: "", category: "" });
            }}
            className={styles.form}
          >
            {/* カテゴリ選択 */}
            <div className={styles.inputGroup}>
              <label className={styles.label}>📂 カテゴリ</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                required
                className={styles.input}
              >
                <option value="">選択してください</option>
                <option value="food">食費</option>
                <option value="transport">交通費</option>
                <option value="beauty">衣服・美容</option>
                <option value="entertainment">娯楽費</option>
                <option value="investment">投資</option>
                <option value="other">その他</option>
              </select>
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>📝 項目名</label>
              <input
                type="text"
                placeholder="例: ランチ代"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })} 
                //...はスプレッド構文、formの中身を全部展開して、その後titleだけ新しい値に更新。展開とは、オブジェクトや配列の中身を個別の要素に分解すること。
                // e.target.valueは入力された値で、フォームの中身を更新するために使用される。
                required //「空欄では送信できない」ようにする簡易バリデーション
                className={styles.input}
              />
            </div>
            
            <div className={styles.inputGroup}>
              <label className={styles.label}>💰 金額</label>
              <input
                type="number"
                placeholder="1000"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                required
                className={styles.input}
              />
            </div>
            
            <div className={styles.inputGroup}>
              <label className={styles.label}>📅 日付</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
                className={styles.input}
              />
            </div>
            
            <button type="submit" className={styles.submitButton}>
              ➕ 追加
            </button>
          </form>
        </div>

        {/* データ一覧 */}
        <div className={styles.dataSection}>
          <h2 className={styles.dataTitle}>📋 支出一覧</h2>
          
          {data.length === 0 ? (
            //条件式 ? Trueの処理 : Falseの処理
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>📝</div>
              <p className={styles.emptyText}>まだデータがありません</p>
              <p className={styles.emptySubtext}>上のフォームから新しい記録を追加しましょう！</p>
            </div>
          ) : (
            <div className={styles.dataList}>
              {data.map((item) => (
                <div key={item.id} className={styles.dataItem}>   {/*React の重要な属性 で、リスト要素をレンダリングする際に各要素を一意に識別するために使用される*/}
                  <div className={styles.itemContent}>
                    <div className={styles.itemTitle}>
                      🏷️ {item.title}
                    </div>
                    <div className={`${styles.itemCategory} ${getCategoryClass(item.category)}`}>
                      {categoryLabels[item.category]}
                    </div>
                    <div className={styles.itemDetails}>
                      <span className={`${styles.itemAmount} ${parseInt(item.amount) >= 0 ? styles.amountPositive : styles.amountNegative}`}> {/*parseIntは文字列を整数に変換する関数*/}
                        💰 ¥{parseInt(item.amount).toLocaleString()}
                      </span>
                      <span>📅 {item.date}</span>
                    </div>
                  </div>
                  
                  {/*削除ボタンの追加*/}
                  <button 
                    onClick={() => deleteItem(item.id)} 
                    className={styles.deleteButton}
                  >
                    🗑️ 削除
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}