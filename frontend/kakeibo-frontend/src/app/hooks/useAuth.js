import { useState, useEffect } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";

export function useAuth() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const checkAuth = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/auth/me`, {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                setUser(data.user);
                setError(null);
            } else {
                setUser(null);
                if (response.status !== 401) {
                    setError('認証確認に失敗しました');
                }
            }
        } catch (err) {
            console.error('Auth check failed:', err);
            setUser(null);
            setError('認証確認でエラーが発生しました');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkAuth();
    }, []);

    return { user, loading, error, checkAuth };
}