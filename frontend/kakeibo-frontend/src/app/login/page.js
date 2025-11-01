"use client";

import { useState } from "react";
import styles from "./page.module.css";

export default function LoginPage() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [status, setStatus] = useState({ type: "idle", message: "" });
  const [userInfo, setUserInfo] = useState(null);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus({ type: "loading", message: "送信中..." });
    setUserInfo(null);

    try {
      const response = await fetch("https://kakeibo-backend-7c1q.onrender.com/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(form),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "ログインに失敗しました。");
      }

      setStatus({ type: "success", message: result.message || "ログインに成功しました。" });
      setUserInfo(result.user || null);
      setForm({ email: "", password: "" });
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    }
  };

  return (
    <div className={styles.page}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <h1 className={styles.heading}>ログイン</h1>

        <label className={styles.label}>
          メールアドレス
          <input
            className={styles.input}
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            required
          />
        </label>

        <label className={styles.label}>
          パスワード
          <input
            className={styles.input}
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            required
          />
        </label>

        <button className={styles.button} type="submit" disabled={status.type === "loading"}>
          {status.type === "loading" ? "送信中..." : "ログイン"}
        </button>

        {status.type === "error" && <p className={styles.error}>{status.message}</p>}
        {status.type === "success" && <p className={styles.success}>{status.message}</p>}

        {userInfo && (
          <div className={styles.userBox}>
            {/* <p>ユーザーID: {userInfo.id}</p> */}
            <p>メール: {userInfo.email}</p>
            {userInfo.name && <p>名前: {userInfo.name}</p>}
          </div>
        )}
      </form>
    </div>
  );
}
