"use client";

import { useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";

export default function TestAuth() {
    const [result, setResult] = useState('');
    const [token, setTokenState] = useState('');

    const checkLocalStorage = () => {
        const storedToken = localStorage.getItem('authToken');
        setResult(`LocalStorage authToken: ${storedToken ? 'EXISTS' : 'NOT FOUND'}\nToken preview: ${storedToken ? storedToken.substring(0, 50) + '...' : 'null'}`);
        setTokenState(storedToken || '');
    };

    const testLogin = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ 
                    email: 'example3@example.com', 
                    password: 'password123' 
                })
            });

            const data = await response.json();
            
            if (data.token) {
                localStorage.setItem('authToken', data.token);
                setResult(`Login successful!\nToken received: ${data.token.substring(0, 50)}...\nToken saved to localStorage`);
                setTokenState(data.token);
            } else {
                setResult(`Login response: ${JSON.stringify(data, null, 2)}`);
            }
        } catch (error) {
            setResult(`Login error: ${error.message}`);
        }
    };

    const testAuthWithToken = async () => {
        try {
            const storedToken = localStorage.getItem('authToken');
            const headers = {
                'Content-Type': 'application/json',
            };
            
            if (storedToken) {
                headers['Authorization'] = `Bearer ${storedToken}`;
            }

            const response = await fetch(`${API_BASE}/api/auth/me`, {
                method: 'GET',
                credentials: 'include',
                headers: headers
            });

            const data = await response.json();
            setResult(`Auth test result:\nStatus: ${response.status}\nHeaders sent: ${JSON.stringify(headers, null, 2)}\nResponse: ${JSON.stringify(data, null, 2)}`);
        } catch (error) {
            setResult(`Auth test error: ${error.message}`);
        }
    };

    const clearToken = () => {
        localStorage.removeItem('authToken');
        setResult('Token cleared from localStorage');
        setTokenState('');
    };

    return (
        <div style={{ padding: '20px', fontFamily: 'monospace' }}>
            <h1>JWT Authentication Test</h1>
            
            <div style={{ marginBottom: '20px' }}>
                <button onClick={checkLocalStorage} style={{ margin: '5px', padding: '10px' }}>
                    Check LocalStorage
                </button>
                <button onClick={testLogin} style={{ margin: '5px', padding: '10px' }}>
                    Test Login
                </button>
                <button onClick={testAuthWithToken} style={{ margin: '5px', padding: '10px' }}>
                    Test Auth with Token
                </button>
                <button onClick={clearToken} style={{ margin: '5px', padding: '10px' }}>
                    Clear Token
                </button>
            </div>

            <div style={{ 
                backgroundColor: '#f5f5f5', 
                padding: '15px', 
                borderRadius: '5px',
                whiteSpace: 'pre-wrap',
                minHeight: '200px'
            }}>
                <strong>Result:</strong><br/>
                {result || 'Click a button to test...'}
            </div>

            {token && (
                <div style={{ marginTop: '20px' }}>
                    <strong>Current Token:</strong><br/>
                    <textarea 
                        value={token} 
                        readOnly 
                        style={{ width: '100%', height: '100px', fontFamily: 'monospace' }}
                    />
                </div>
            )}
        </div>
    );
}