import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Card, Button, Badge } from '../components/ui/Common.tsx';
import { api } from '../api.ts';
import { useAuth } from '../App.tsx';
import { useI18n } from '../i18n.tsx';

export const OrderNew: React.FC = () => {
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const domain = searchParams.get('domain') || '';
  const priceParam = searchParams.get('price') || '';
  const price = useMemo(() => {
    const parsed = Number(priceParam);
    return Number.isFinite(parsed) ? parsed : null;
  }, [priceParam]);
  const [balance, setBalance] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoadingBalance(true);
    api.get<{ balance: number }>('/billing/balance')
      .then((res) => setBalance(res.balance))
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoadingBalance(false));
  }, []);

  const handlePurchase = async () => {
    if (!domain || price === null) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post<{ orderId: string }>('/domains', {
        name: domain,
        years: 1,
        autoRenew: true,
        privacyProtection: true,
      });
      navigate(`/orders/${res.orderId}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-xl mx-auto">
        <Card title={t('ordernew.signin')}>
          <div className="text-sm text-zinc-400">{t('ordernew.signin.copy')}</div>
        </Card>
      </div>
    );
  }

  if (!domain || price === null) {
    return (
      <div className="max-w-xl mx-auto">
        <Card title={t('ordernew.invalid')}>
          <div className="text-sm text-zinc-400">{t('ordernew.invalid.copy')}</div>
          <div className="mt-4">
            <Link to="/"><Button>{t('ordernew.back')}</Button></Link>
          </div>
        </Card>
      </div>
    );
  }

  const hasBalance = balance !== null && balance >= price;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{t('ordernew.title')}</h1>
        <p className="text-sm text-zinc-500">{t('ordernew.subtitle')}</p>
      </div>

      <Card>
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">{t('ordernew.domain')}</span>
            <span className="text-white font-mono">{domain}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">{t('ordernew.price')}</span>
            <span className="text-white font-medium">${price.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">{t('ordernew.balance')}</span>
            <span className="text-white font-medium">
              {loadingBalance ? 'Loading...' : balance !== null ? `$${balance.toFixed(2)}` : '--'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Badge variant="info">{t('ordernew.balancebadge')}</Badge>
            <span>{t('ordernew.defaultpayment')}</span>
          </div>
        </div>
      </Card>

      {!hasBalance && balance !== null && (
        <Card className="border-amber-500/30">
          <div className="text-sm text-amber-400">{t('ordernew.insufficient')}</div>
          <div className="mt-4">
            <Button variant="outline" onClick={() => navigate('/billing?topup=1')}>
              {t('ordernew.topup')}
            </Button>
          </div>
        </Card>
      )}

      {error && (
        <div className="text-sm text-amber-400">{error}</div>
      )}

      <div className="flex items-center gap-3">
        <Button
          className="h-11"
          disabled={!hasBalance || submitting || loadingBalance}
          isLoading={submitting}
          onClick={handlePurchase}
        >
          {t('ordernew.pay')}
        </Button>
        <Button variant="ghost" onClick={() => navigate('/')}>{t('ordernew.cancel')}</Button>
      </div>
    </div>
  );
};
