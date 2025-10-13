"use client";
import { useEffect, useState } from "react";

export default function Home() {
  const [data, setData] = useState([]); //データベース状態管理

  useEffect(() => {
    fetch("http://localhost:3000/api/kakeibo")
      .then((res) => res.json())
      .then((result) => setData(result))
      .catch((err) => console.error(err));
  }, []);

  return (
    <main style={{ padding: "20px" }}>
      <h1>家計簿一覧表示</h1> 
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
