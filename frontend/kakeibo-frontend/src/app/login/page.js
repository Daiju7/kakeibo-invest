"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../hooks/useAuth";
import styles from "./page.module.css";

export default function LoginPage() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [status, setStatus] = useState({ type: "idle", message: "" });
  const { login } = useAuth();
  const router = useRouter();

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus({ type: "loading", message: "送信中..." });

    try {
      console.log('🔐 Attempting login with:', { email: form.email });
      const result = await login(form.email, form.password);

      if (result.success) {
        console.log('✅ Login successful, redirecting...');
        setStatus({ type: "success", message: "ログインに成功しました。リダイレクト中..." });
        setForm({ email: "", password: "" });
        
        // 少し待ってからリダイレクト
        setTimeout(() => {
          router.push('/');
        }, 1000);
      } else {
        console.log('❌ Login failed:', result.error);
        setStatus({ type: "error", message: result.error || "ログインに失敗しました。" });
      }
    } catch (error) {
      console.error('❌ Login error:', error);
      setStatus({ type: "error", message: error.message || "ログインでエラーが発生しました。" });
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
      </form>
    </div>
  );
}
