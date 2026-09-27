'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export default function SignupPage() {
  const { signup } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'PASSENGER' | 'DRIVER'>('PASSENGER');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signup(name, email, password, role);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Signup failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-white to-gray-50 px-4">
      <div className="w-full max-w-sm bg-white p-8 rounded-3xl shadow-xl border border-gray-100">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-green-600 text-white text-xl font-bold mb-3">
            T
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Join Dhaka Tesla Pool</h1>
          <p className="text-sm text-gray-500 mt-1">Create your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent transition"
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent transition"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent transition"
          />

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setRole('PASSENGER')}
              className={`flex-1 py-3 rounded-xl border text-sm font-medium transition ${
                role === 'PASSENGER'
                  ? 'bg-green-600 text-white border-green-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-green-300'
              }`}
            >
              Passenger
            </button>
            <button
              type="button"
              onClick={() => setRole('DRIVER')}
              className={`flex-1 py-3 rounded-xl border text-sm font-medium transition ${
                role === 'DRIVER'
                  ? 'bg-green-600 text-white border-green-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-green-300'
              }`}
            >
              Driver
            </button>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 text-white rounded-xl py-3 font-medium text-sm hover:bg-green-700 transition disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Sign Up'}
          </button>
        </form>

        <p className="text-sm text-center mt-5 text-gray-500">
          Already have an account?{' '}
          <Link href="/login" className="text-green-600 font-medium hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}