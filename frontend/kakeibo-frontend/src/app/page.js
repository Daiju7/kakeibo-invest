"use client";
import { useEffect, useState } from "react";



export default function Home() {

  const [data, setData] = useState([]); //データベース状態管理
  const [form, setForm] = useState({ title: "", amount: "", date: "" });　//フォーム状態管理
  
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


  

  return (
    <main style={{ padding: "20px" }}>
      <h1>家計簿一覧表示</h1> 

      <form
        onSubmit={(e) => {
          e.preventDefault(); // ページリロード防止
          console.log(form);  // 今のフォームの内容を確認
          //フォームの中をリセット
          setForm({ title: "", amount: "", date: "" });
        }}
        style={{ marginBottom: "20px" }}
      >
        <input
          type="text"
          placeholder="項目名"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })} 
          //...はスプレッド構文、formの中身を全部展開して、その後titleだけ新しい値に更新。展開とは、オブジェクトや配列の中身を個別の要素に分解すること。
          // e.target.valueは入力された値で、フォームの中身を更新するために使用される。
          required //「空欄では送信できない」ようにする簡易バリデーション
        />
        <input
          type="number"
          placeholder="金額"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
          required
        />
        <input
          type="date"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
          required
        />
        <button type="submit" style={{ marginLeft: "30px" }}>追加</button>
      </form>


      {data.length === 0 ? (
        //条件式 ? Trueの処理 : Falseの処理
        <p>データがありません</p>
      ) : (
        <ul>
          {data.map((item) => (
            <li key={item.id}>   {/*React の重要な属性 で、リスト要素をレンダリングする際に各要素を一意に識別するために使用される*/}
              {item.title} - ¥{item.amount} - {item.date}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

//次はpostリクエストの処理開発