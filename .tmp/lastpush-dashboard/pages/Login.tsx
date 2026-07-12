import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, Button, Input } from '../components/ui/Common.tsx';
import { Mail, Twitter, ArrowRight, CheckCircle2, Wallet } from 'lucide-react';
import { useAuth } from '../App.tsx';
import { useAccount, useConnect, useSignMessage, useDisconnect } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { api } from '../api.ts';
import { User } from '../types.ts';
import { useI18n } from '../i18n.tsx';

export const Login: React.FC = () => {
  const { setSession, updateUser, user } = useAuth();
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const redirect = searchParams.get('redirect') || '/dashboard';
  const callbackRedirect = '/dashboard';
  
  const [step, setStep] = useState<'methods' | 'email' | 'emailVerify' | 'onboarding'>('methods');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [challengeId, setChallengeId] = useState('');
  const [code, setCode] = useState('');
  const handledTokenRef = useRef(false);

  // Wagmi Hooks
  const { address, isConnected } = useAccount();
  const { connect, isPending } = useConnect();
  const { signMessageAsync } = useSignMessage();
  const { disconnect } = useDisconnect();

  // Handle Wallet Login Sequence
  useEffect(() => {
    if (user) {
      navigate('/dashboard');
      return;
    }
    const handleWalletAuth = async () => {
      if (isConnected && address && step === 'methods') {
        try {
          const nonceRes = await api.post<{ nonce: string }>('/auth/login/wallet/nonce', {
            address,
            chainId: 1,
          });
          const signature = await signMessageAsync({ message: nonceRes.nonce });
          const verify = await api.post<{ token: string; user: User }>('/auth/login/wallet/verify', {
            address,
            signature,
            nonce: nonceRes.nonce,
          });
          setSession(verify.token, verify.user);
          setStep('onboarding');
        } catch (error) {
          console.error("User rejected signature", error);
          disconnect();
        }
      }
    };

    handleWalletAuth();
  }, [isConnected, address, step, signMessageAsync, disconnect, user, navigate]);


  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await api.post<{ challengeId: string }>('/auth/login/email', {
        email,
        redirect,
      });
      setChallengeId(res.challengeId);
      setStep('emailVerify');
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const verify = await api.post<{ token: string; user: User }>('/auth/login/email/verify', {
        challengeId,
        code,
      });
      setSession(verify.token, verify.user);
      navigate('/dashboard');
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteOnboarding = async () => {
    try {
      const desiredHandle =
        email ? email.split('@')[0] : address ? `0x${address.slice(2, 8)}` : 'user';
      const updated = await api.patch<User>('/users/me', {
        handle: desiredHandle,
      });
      updateUser(updated);
    } catch (err) {
      console.error(err);
    }
    navigate(redirect);
  };

  const handleXLogin = () => {
    const base = import.meta.env.VITE_API_BASE || 'https://api.lastpush.xyz';
    const callbackUrl = `${window.location.origin}/#/login`;
    const target = `${base}/x_login?redirect=${encodeURIComponent(redirect)}&callback=${encodeURIComponent(callbackUrl)}`;
    window.location.href = target;
  };

  useEffect(() => {
    const hashQuery = window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '';
    const token =
      searchParams.get('token') ||
      new URLSearchParams(window.location.search).get('token') ||
      new URLSearchParams(hashQuery).get('token');
    if (!token || handledTokenRef.current || user) return;
    handledTokenRef.current = true;
    const run = async () => {
      let success = false;
      try {
        const res = await api.post<{ token: string; user: User }>('/auth/login/x/verify', { token });
        setSession(res.token, res.user);
        success = true;
      } catch {
        try {
          localStorage.setItem('lastpush_token', token);
          const me = await api.get<User>('/users/me');
          setSession(token, me);
          success = true;
        } catch {
          localStorage.removeItem('lastpush_token');
        }
      }
      if (success) {
        navigate(callbackRedirect, { replace: true });
      }
    };
    run();
  }, [searchParams, navigate, setSession, user, callbackRedirect]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
      <Card className="w-full max-w-md border-zinc-800 bg-zinc-900">
        <div className="text-center mb-8">
           <h2 className="text-2xl font-bold text-white mb-2">{t('login.title')}</h2>
           <p className="text-zinc-500 text-sm">{t('login.subtitle')}</p>
        </div>

        {step === 'methods' && (
          <div className="space-y-4">
            <div className="w-full space-y-2">
              {!isConnected ? (
                <Button 
                  variant="secondary"
                  className="w-full h-12 justify-between px-6"
                  onClick={() => connect({ connector: injected() })}
                  isLoading={isPending}
                >
                  <span className="flex items-center gap-3">
                    <Wallet className="w-5 h-5 text-indigo-400" />
                    {t('login.wallet')}
                  </span>
                  <ArrowRight className="w-4 h-4 text-zinc-500" />
                </Button>
              ) : (
                <div className="text-center space-y-2">
                  <div className="text-zinc-400 text-sm">{t('login.walletconnected')}</div>
                  <Button variant="outline" className="w-full font-mono" onClick={() => disconnect()}>
                    {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : t('login.walletconnected')}
                  </Button>
                </div>
              )}
            </div>
            
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-zinc-800"></div>
              <span className="flex-shrink-0 mx-4 text-zinc-600 text-xs uppercase">{t('login.or')}</span>
              <div className="flex-grow border-t border-zinc-800"></div>
            </div>

            <Button variant="secondary" className="w-full h-12 justify-between px-6" onClick={() => setStep('email')}>
              <span className="flex items-center gap-3"><Mail className="w-5 h-5 text-zinc-400" /> {t('login.continue.email')}</span>
              <ArrowRight className="w-4 h-4 text-zinc-500" />
            </Button>

            <Button variant="secondary" className="w-full h-12 justify-between px-6" onClick={handleXLogin}>
              <span className="flex items-center gap-3"><Twitter className="w-5 h-5 text-blue-400" /> {t('login.continue.x')}</span>
              <ArrowRight className="w-4 h-4 text-zinc-500" />
            </Button>
          </div>
        )}

        {step === 'email' && (
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <Input 
              label={t('login.email.label')}
              type="email" 
              placeholder={t('login.email.placeholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
            <Button type="submit" className="w-full" isLoading={loading}>
              {loading ? t('login.sending') : t('login.sendlink')}
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => setStep('methods')}>{t('login.back')}</Button>
          </form>
        )}

        {step === 'emailVerify' && (
          <form onSubmit={handleVerifyEmail} className="space-y-4">
            <Input
              label={t('login.code.label')}
              type="text"
              placeholder={t('login.code.placeholder')}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              autoFocus
            />
            <Button type="submit" className="w-full" isLoading={loading}>
              {loading ? t('login.verifying') : t('login.verify')}
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => setStep('email')}>{t('login.back')}</Button>
          </form>
        )}

        {step === 'onboarding' && (
          <div className="space-y-6 animate-in fade-in zoom-in-95">
            <div className="flex justify-center">
              <CheckCircle2 className="w-16 h-16 text-emerald-500" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-medium text-white">{t('login.almost')}</h3>
              <p className="text-zinc-500 text-sm">
                {address
                  ? t('login.walletconnected.short', { short: `${address.slice(0, 6)}...${address.slice(-4)}` })
                  : t('login.onboarding')}
              </p>
            </div>
            <Input 
              label={t('login.username')}
              defaultValue={
                email ? email.split('@')[0] : 
                address ? `0x${address.slice(2,8)}` : 'anon_dev'
              } 
            />
            <Input label={t('login.workspace')} placeholder="My Team" />
            <Button className="w-full" onClick={handleCompleteOnboarding}>{t('login.enter')}</Button>
          </div>
        )}
      </Card>
    </div>
  );
};
