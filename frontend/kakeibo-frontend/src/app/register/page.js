"use client";

import { useState } from "react";
import styles from "./page.module.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";

export default function RegisterPage() {
  const [form, setForm] = useState({ email: "", password: "", name: "" });
  const [status, setStatus] = useState({ type: "idle", message: "" });

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus({ type: "loading", message: "送信中..." });

    try {
      const response = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(form),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "登録に失敗しました。");
      }

      setStatus({ type: "success", message: result.message || "登録が完了しました。" });
      setForm({ email: "", password: "", name: "" });
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    }
  };

  return (
    <div className={styles.page}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <h1 className={styles.heading}>新規登録</h1>

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

        <label className={styles.label}>
          名前（任意）
          <input
            className={styles.input}
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
          />
        </label>

        <button className={styles.button} type="submit" disabled={status.type === "loading"}>
          {status.type === "loading" ? "送信中..." : "登録する"}
        </button>

        {status.type === "error" && <p className={styles.error}>{status.message}</p>}
        {status.type === "success" && <p className={styles.success}>{status.message}</p>}
      </form>
    </div>
  );
}
