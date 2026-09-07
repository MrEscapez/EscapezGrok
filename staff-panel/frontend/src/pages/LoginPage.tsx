import { FormEvent, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { ApiError, login, type StaffUser } from '../lib/api';
import { useMeQuery } from '../hooks/useMeQuery';

export function LoginPage() {
  const queryClient = useQueryClient();
  const meQuery = useMeQuery();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loginMutation = useMutation({
    mutationFn: () => login(username.trim(), password),
    onSuccess: (data) => {
      setError(null);
      queryClient.setQueryData<StaffUser>(['auth', 'me'], data.user);
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        setError(err.message || 'Inloggen mislukt');
      } else {
        setError('Kan de server niet bereiken. Is de API gestart?');
      }
    },
  });

  if (meQuery.isSuccess && meQuery.data) {
    return <Navigate to="/dashboard" replace />;
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password) {
      setError('Vul gebruikersnaam en wachtwoord in.');
      return;
    }
    loginMutation.mutate();
  }

  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={onSubmit} noValidate>
        <div className="login-card__brand">
          <span className="sidebar__logo">EC</span>
          <div>
            <h1 className="login-card__title">EscapezCraft</h1>
            <p className="login-card__subtitle">Staff Panel — inloggen</p>
          </div>
        </div>

        {error ? (
          <div className="login-card__error" role="alert">
            {error}
          </div>
        ) : null}

        <label className="login-field">
          <span>Gebruikersnaam</span>
          <input
            type="text"
            name="username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={loginMutation.isPending}
            required
          />
        </label>

        <label className="login-field">
          <span>Wachtwoord</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loginMutation.isPending}
            required
          />
        </label>

        <button
          type="submit"
          className="login-card__submit"
          disabled={loginMutation.isPending}
        >
          {loginMutation.isPending ? 'Bezig…' : 'Inloggen'}
        </button>

        <p className="login-card__hint">
          Lokale demo: sessie via HttpOnly cookie (geen JWT in localStorage).
        </p>
      </form>
    </div>
  );
}
