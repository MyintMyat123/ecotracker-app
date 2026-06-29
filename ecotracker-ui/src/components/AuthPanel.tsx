import React, { useState } from 'react';
import { apiRequest, type AuthUser } from '../api';

interface AuthPanelProps {
  onAuthenticated: (user: AuthUser, token: string) => void;
  mode: 'login' | 'register';
  onSwitchMode: (mode: 'login' | 'register') => void;
}

const AuthPanel: React.FC<AuthPanelProps> = ({ onAuthenticated, mode, onSwitchMode }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!isValidEmail(email)) {
      setError('Enter a valid email address.');
      return;
    }

    setLoading(true);

    try {
      const result = await apiRequest<{ user: AuthUser; token: string }>(
        mode === 'login' ? '/auth/login' : '/auth/register',
        {
          method: 'POST',
          body: JSON.stringify(
            mode === 'login'
              ? { email, password }
              : { name, email, password, password_confirmation: passwordConfirmation }
          ),
        }
      );

      onAuthenticated(result.user, result.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="max-w-md mx-auto px-6 py-10">
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 md:p-8">
        <div className="space-y-2">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">
              {mode === 'login' ? 'Sign in' : 'Sign up'}
            </h1>
            <p className="text-sm text-slate-400 mt-2">
              {mode === 'login'
                ? 'Access your saved species watchlist.'
                : 'Create an account to save species to your watchlist.'}
            </p>
          </div>
        </div>

        <form onSubmit={submit} noValidate className="space-y-4 mt-6">
          {mode === 'register' && (
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Name"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-emerald-500"
            />
          )}
          <input
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (error === 'Enter a valid email address.') setError(null);
            }}
            placeholder="Email"
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-emerald-500"
          />
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-emerald-500"
          />
          {mode === 'register' && (
            <input
              type="password"
              value={passwordConfirmation}
              onChange={(event) => setPasswordConfirmation(event.target.value)}
              placeholder="Confirm password"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-emerald-500"
            />
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white rounded-lg px-4 py-3 text-xs font-black uppercase tracking-widest"
          >
            {loading ? 'Please wait' : mode === 'login' ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        {error && (
          <div className="mt-4 text-sm text-red-300 bg-red-950/40 border border-red-500/30 rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <div className="mt-6 text-center text-sm text-slate-400">
          {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button
            type="button"
            onClick={() => onSwitchMode(mode === 'login' ? 'register' : 'login')}
            className="p-0 bg-transparent border-0 text-emerald-400 hover:text-emerald-300 font-bold"
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </div>
      </div>
    </section>
  );
};

export default AuthPanel;
