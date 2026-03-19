import React, { useState } from 'react';
import { User, Lock, Server } from 'lucide-react';
import TargetCursor from './ReactBits/TargetCursor';

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

    const handleMicrosoftLogin = () => {
        window.location.href = '/auth/microsoft';
    };

    return (
        <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
            <TargetCursor 
              spinDuration={2}
              hideDefaultCursor={true}
              parallaxOn={true}
              hoverDuration={0.2}
            />
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
                        onClick={handleMicrosoftLogin}
                        className="mt-6 w-full flex items-center justify-center space-x-2 bg-white text-gray-800 hover:bg-gray-100 font-semibold py-2 rounded-md transition-colors"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 21 21">
                            <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
                            <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
                            <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
                            <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
                        </svg>
                        <span>Sign in with Microsoft</span>
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
