import { useState, useEffect } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";

// トークン管理
const getToken = () => {
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('authToken');
        console.log('🔍 getToken() called, result:', !!token);
        return token;
    }
    console.log('🔍 getToken() called on server side, returning null');
    return null;
};

const setToken = (token) => {
    if (typeof window !== 'undefined') {
        console.log('🔐 setToken() called with token:', token ? token.substring(0, 20) + '...' : 'null');
        localStorage.setItem('authToken', token);
        
        // 保存確認
        const saved = localStorage.getItem('authToken');
        console.log('🔐 Token save verification:', !!saved, saved === token ? 'MATCH' : 'MISMATCH');
    } else {
        console.log('🔐 setToken() called on server side, ignoring');
    }
};

const removeToken = () => {
    if (typeof window !== 'undefined') {
        console.log('🗑️ removeToken() called');
        localStorage.removeItem('authToken');
    }
};

export function useAuth() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const checkAuth = async () => {
        try {
            console.log('🔍 Checking auth with API_BASE:', API_BASE);
            
            const token = getToken();
            console.log('🔍 Retrieved token from localStorage:', !!token);
            console.log('🔍 Token preview:', token ? token.substring(0, 20) + '...' : 'null');
            
            const headers = {
                'Content-Type': 'application/json',
            };
            
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
                console.log('🔍 Using JWT token for auth, header set');
            } else {
                console.log('🔍 No JWT token found, using session');
            }
            
            console.log('🔍 Request headers:', headers);
            
            const response = await fetch(`${API_BASE}/api/auth/me`, {
                method: 'GET',
                credentials: 'include',
                headers: headers
            });

            console.log('🔍 Auth response status:', response.status);
            console.log('🔍 Auth response headers:', Object.fromEntries(response.headers.entries()));

            if (response.ok) {
                const data = await response.json();
                console.log('✅ Auth successful:', data);
                setUser(data.user);
                setError(null);
            } else {
                console.log('❌ Auth failed:', response.status);
                setUser(null);
                removeToken(); // 無効なトークンを削除
                if (response.status !== 401) {
                    setError('認証確認に失敗しました');
                }
            }
        } catch (err) {
            console.error('Auth check failed:', err);
            setUser(null);
            removeToken();
            setError('認証確認でエラーが発生しました');
        } finally {
            setLoading(false);
        }
    };

    const login = async (email, password) => {
        try {
            console.log('🔐 Starting login process...');
            const response = await fetch(`${API_BASE}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email, password })
            });

            console.log('🔐 Login response status:', response.status);
            
            if (response.ok) {
                const data = await response.json();
                console.log('🔐 Login response data:', data);
                
                if (data.token) {
                    console.log('🔐 Saving JWT token to localStorage...');
                    setToken(data.token);
                    
                    // 保存されたか確認
                    const savedToken = getToken();
                    console.log('🔐 Token saved successfully:', !!savedToken);
                    console.log('🔐 Token preview:', savedToken ? savedToken.substring(0, 20) + '...' : 'null');
                } else {
                    console.warn('⚠️ No token in login response');
                }
                
                setUser(data.user);
                setError(null);
                return { success: true };
            } else {
                const data = await response.json();
                console.log('❌ Login failed with response:', data);
                setError(data.error || 'ログインに失敗しました');
                return { success: false, error: data.error };
            }
        } catch (err) {
            console.error('❌ Login failed:', err);
            setError('ログインでエラーが発生しました');
            return { success: false, error: 'ログインでエラーが発生しました' };
        }
    };

    const logout = () => {
        removeToken();
        setUser(null);
        setError(null);
    };

    useEffect(() => {
        checkAuth();
    }, []);

    return { user, loading, error, checkAuth, login, logout };
}