"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from './page.module.css';
import CycleChart from "./components/Cycle-Chart";

export default function Page() {
  const [data, setData] = useState([]); //データベース状態管理
  const [form, setForm] = useState({ title: "", amount: "", date: "", category: "" }); //フォーム状態管理
  const [showAllExpenses, setShowAllExpenses] = useState(false);
  const [authError, setAuthError] = useState(null);
  
  //データ取得 　useEffectはコンポーネントのライフサイクルに基づいて副作用を実行するためのフック コンポーネントがマウント（初回レンダリング）されたときにfetchData関数を実行してデータを取得する
  useEffect(() => {
    fetchData();
  }, []);

  //データ取得関数 （データ取得初回ロード時だけでなく、データ追加・削除後にも実行したいため、非同期処理にする）
  const fetchData = async() => {
    try {
      const response = await fetch("https://kakeibo-backend-7c1q.onrender.com/api/kakeibo", {
        credentials: "include"
      });

      if (response.status === 401) {
        setAuthError("家計簿データを見るにはログインが必要です。");
        setData([]);
        return;
      }

      const result = await response.json();
      setData(result);
      setAuthError(null);
      console.log('取得できた');
    } catch (error) {
      console.log('Error fetching data:', error);
      setAuthError("家計簿データの取得に失敗しました。");
    }
  }

  //フォーム送信関数
  const submitForm = async() => {
    try {
      const response = await fetch("https://kakeibo-backend-7c1q.onrender.com/api/kakeibo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form)
      });

      if (response.status === 401) {
        setAuthError("支出を追加するにはログインが必要です。");
        return;
      }

      const result = await response.json();
      console.log(result);
      setAuthError(null);
      fetchData(); //データ再取得
    } catch (error) {
    console.log('Error submitting form:', error);
    setAuthError("家計簿データの追加に失敗しました。");
    }
  }

  //削除関数
  const deleteItem = async(id) => {
    try{
      const response = await fetch(`https://kakeibo-backend-7c1q.onrender.com/api/kakeibo/${id}`, {
        method:"DELETE",
        credentials: "include"
      });

      if (response.status === 401) {
        setAuthError("支出を削除するにはログインが必要です。");
        return;
      }

      const result = await response.json();
      console.log(result);
      setAuthError(null);
      fetchData(); //データ再取得
    } catch (error) {
      console.log('Error deleting item:', error);
      setAuthError("家計簿データの削除に失敗しました。");
    }
  }

  // 金額の合計を計算
  const totalAmount = data.reduce((sum, item) => sum + parseInt(item.amount), 0);

  //表示制御ロジック
  //一覧表示の最大件数を定義し、全件表示の切り替えを管理
  const MAX_VISIBLE_ITEMS = 2;
  const hasMoreExpenses = data.length > MAX_VISIBLE_ITEMS;
  //useMemoは、計算コストの高い関数の結果をメモ化（キャッシュ）して、依存関係が変わらない限り再計算を避けるためのフック
  const displayedExpenses = useMemo(
    () => (showAllExpenses ? data : data.slice(0, MAX_VISIBLE_ITEMS)),
    [data, showAllExpenses]
  );

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

  //カテゴリー毎の合計金額を計算
  const getCategoryTotal = (category) => {
    return data
      .filter(item => item.category === category)
      .reduce((sum, item) => sum + parseInt(item.amount), 0); //reduceは配列の各要素に対して累積的な操作を行い、単一の値を生成するメソッド。ここでは、指定されたカテゴリーに属するすべての項目の金額を合計している。
  };

  return (
    <div className={styles.page}>
      {authError && (
        <div className={styles.authError}>
          <p>{authError}</p>
          <Link href="/login" className={styles.authLink}>ログインページへ</Link>
        </div>
      )}
      <section className={styles.overviewGrid}>
        <article className={styles.summaryCard}>
          <div>
            <h1 className={styles.title}>🏠 家計簿アプリ</h1>
            <p className={styles.subtitle}>日常の支出と投資の可能性をひと目で把握</p>
          </div>

          <div className={`${styles.totalAmount} ${totalAmount >= 0 ? styles.totalPositive : styles.totalNegative}`}>
            <span>📊 合計</span>
            <span>¥{totalAmount.toLocaleString()}</span>
          </div>

          <div className={styles.categoryTotals}>
            <div className={styles.categoryTotalItem}>
              <span className={styles.categoryIcon}>🍽️</span>
              <span className={styles.categoryName}>食費</span>
              <span className={styles.categoryAmount}>¥{getCategoryTotal("food").toLocaleString()}</span>
            </div>
            <div className={styles.categoryTotalItem}>
              <span className={styles.categoryIcon}>🚃</span>
              <span className={styles.categoryName}>交通費</span>
              <span className={styles.categoryAmount}>¥{getCategoryTotal("transport").toLocaleString()}</span>
            </div>
            <div className={styles.categoryTotalItem}>
              <span className={styles.categoryIcon}>💄</span>
              <span className={styles.categoryName}>衣服・美容費</span>
              <span className={styles.categoryAmount}>¥{getCategoryTotal("beauty").toLocaleString()}</span>
            </div>
            <div className={styles.categoryTotalItem}>
              <span className={styles.categoryIcon}>🎮</span>
              <span className={styles.categoryName}>娯楽費</span>
              <span className={styles.categoryAmount}>¥{getCategoryTotal("entertainment").toLocaleString()}</span>
            </div>
            <div className={styles.categoryTotalItem}>
              <span className={styles.categoryIcon}>💰</span>
              <span className={styles.categoryName}>投資</span>
              <span className={styles.categoryAmount}>¥{getCategoryTotal("investment").toLocaleString()}</span>
            </div>
            <div className={styles.categoryTotalItem}>
              <span className={styles.categoryIcon}>📦</span>
              <span className={styles.categoryName}>その他</span>
              <span className={styles.categoryAmount}>¥{getCategoryTotal("other").toLocaleString()}</span>
            </div>
          </div>
        </article>

        <article className={styles.chartCard}>
          <h2 className={styles.chartTitle}>📈 カテゴリー別支出割合</h2>
          <CycleChart data={data} />
        </article>
      </section>

      <section className={styles.detailsGrid}>
        <article className={styles.formCard}>
          <h2 className={styles.formTitle}>✏️ 新しい記録を追加</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitForm();
              setForm({ title: "", amount: "", date: "", category: "" });
            }}
            className={styles.form}
          >
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
                required
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
        </article>

        <article className={styles.tableCard}>
          <h2 className={styles.dataTitle}>📋 支出一覧</h2>
          {data.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>📝</div>
              <p className={styles.emptyText}>まだデータがありません</p>
              <p className={styles.emptySubtext}>左のフォームから新しい記録を追加してみましょう</p>
            </div>
          ) : (
            <div className={styles.dataList}>
              {displayedExpenses.map((item) => (
                <div key={item.id} className={styles.dataItem}>
                  <div className={styles.itemContent}>
                    <div className={styles.itemTitle}>🏷️ {item.title}</div>
                    <div className={`${styles.itemCategory} ${getCategoryClass(item.category)}`}>
                      {categoryLabels[item.category]}
                    </div>
                    <div className={styles.itemDetails}>
                      <span className={`${styles.itemAmount} ${parseInt(item.amount) >= 0 ? styles.amountPositive : styles.amountNegative}`}>
                        💰 ¥{parseInt(item.amount).toLocaleString()}
                      </span>
                      <span>📅 {item.date}</span>
                    </div>
                  </div>
                  <button onClick={() => deleteItem(item.id)} className={styles.deleteButton}>
                    🗑️ 削除
                  </button>
                </div>
              ))}
            </div>
          )}
          {hasMoreExpenses && (
            <button
              type="button"
              className={styles.collapseButton}
              onClick={() => setShowAllExpenses((prev) => !prev)}
            >
              {showAllExpenses ? "一覧を閉じる" : `全${data.length}件を表示`}
            </button>
          )}
        </article>
      </section>

      <section className={styles.linksRow}>
        <Link href="/invest" className={styles.linkTile}>
          <div className={styles.linkIcon}>💹</div>
          <div className={styles.linkContent}>
            <h3>投資シミュレーションへ</h3>
            <p>S&P500の株価データを使って、家計簿と投資を組み合わせた分析を体験しましょう。</p>
          </div>
        </Link>
      </section>
    </div>
  );
}
