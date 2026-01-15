import React, { useState } from 'react';
import { User, Lock, Server } from 'lucide-react';

const Login = ({ onLogin }) => {
    const [isLogin, setIsLogin] = useState(true); // Toggle between Login and Setup
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const endpoint = isLogin ? '/api/auth/login' : '/api/auth/setup';

        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();

            if (!res.ok) {
                // If 403 on setup, it means setup is done, switch to login
                if (endpoint.includes('setup') && res.status === 403) {
                    setError('Setup already completed. Please login.');
                    setIsLogin(true);
                } else {
                    throw new Error(data.error || 'Authentication failed');
                }
            } else {
                onLogin(data.user || { username }); // Update parent state
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = () => {
        window.location.href = '/auth/google';
    };

    return (
        <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
            <div className="bg-dark-800 p-8 rounded-lg shadow-2xl w-full max-w-md border border-dark-700">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-mc-green/10 mb-4">
                        <Server className="w-8 h-8 text-mc-green" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Minecraft Panel</h1>
                    <p className="text-gray-400">
                        {isLogin ? 'Sign in to manage your server' : 'Create Admin Account'}
                    </p>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-md mb-6 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Username</label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full bg-dark-900 border border-dark-700 rounded-md py-2 pl-10 pr-4 text-white focus:outline-none focus:border-mc-green transition-colors"
                                placeholder="Enter username"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Password</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-dark-900 border border-dark-700 rounded-md py-2 pl-10 pr-4 text-white focus:outline-none focus:border-mc-green transition-colors"
                                placeholder="••••••••"
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-mc-green hover:bg-green-600 text-dark-900 font-bold py-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
                    </button>
                </form>

                <div className="mt-6">
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-dark-700"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-dark-800 text-gray-500">Or continue with</span>
                        </div>
                    </div>

                    <button
                        onClick={handleGoogleLogin}
                        className="mt-6 w-full flex items-center justify-center space-x-2 bg-white text-gray-800 hover:bg-gray-100 font-semibold py-2 rounded-md transition-colors"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path
                                fill="currentColor"
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            />
                            <path
                                fill="currentColor"
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            />
                            <path
                                fill="currentColor"
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                            />
                            <path
                                fill="currentColor"
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            />
                        </svg>
                        <span>Sign in with Google</span>
                    </button>
                </div>

                <div className="mt-4 text-center">
                    <button
                        onClick={() => { setIsLogin(!isLogin); setError(''); }}
                        className="text-sm text-gray-400 hover:text-white underline"
                    >
                        {isLogin ? "First time? Run Setup" : "Already have an account? Sign In"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Login;
