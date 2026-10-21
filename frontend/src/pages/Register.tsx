import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { User, Mail, Lock, Phone, MapPin, ArrowRight, AlertCircle, Compass } from 'lucide-react';

export const Register: React.FC = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [homeCity, setHomeCity] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await apiClient.post('/users/register', {
        fullName,
        email,
        password,
        phone,
        homeCity,
      });
      navigate('/login');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
      <div className="w-full max-w-md bg-zinc-900 p-8 rounded-3xl shadow-2xl border border-zinc-800 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-zinc-800 text-white border border-zinc-700">
            <Compass className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-extrabold text-white uppercase tracking-wider">Create Account</h1>
          <p className="text-zinc-400 text-xs">Join Wayfare Travel Management Platform</p>
        </div>

        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono uppercase text-zinc-400 mb-1">Full Name</label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3 top-3 text-zinc-500" />
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-zinc-800 bg-zinc-950 text-sm text-white focus:ring-2 focus:ring-zinc-600 outline-none"
                placeholder="John Doe"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono uppercase text-zinc-400 mb-1">Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-3 text-zinc-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-zinc-800 bg-zinc-950 text-sm text-white focus:ring-2 focus:ring-zinc-600 outline-none"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono uppercase text-zinc-400 mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-3 text-zinc-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-zinc-800 bg-zinc-950 text-sm text-white focus:ring-2 focus:ring-zinc-600 outline-none"
                placeholder="Minimum 6 characters"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-mono uppercase text-zinc-400 mb-1">Phone</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-950 text-sm text-white focus:ring-2 focus:ring-zinc-600 outline-none"
                placeholder="+12345678"
              />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase text-zinc-400 mb-1">Home City</label>
              <input
                type="text"
                value={homeCity}
                onChange={(e) => setHomeCity(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-950 text-sm text-white focus:ring-2 focus:ring-zinc-600 outline-none"
                placeholder="New York"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl font-semibold text-zinc-900 bg-white hover:bg-zinc-200 shadow-md flex items-center justify-center space-x-2 transition disabled:opacity-50 mt-2"
          >
            <span>{loading ? 'Creating Account...' : 'Register'}</span>
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        <div className="text-center text-xs text-zinc-500">
          Already registered?{' '}
          <Link to="/login" className="font-semibold text-white hover:underline">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};
