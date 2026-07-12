import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, Button, Badge } from '../components/ui/Common.tsx';
import { api } from '../api.ts';
import { Order } from '../types.ts';
import { useI18n } from '../i18n.tsx';

export const OrderDetail: React.FC = () => {
  const { t } = useI18n();
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statusSteps = useMemo(() => ([
    { key: 'PURCHASING', label: t('orderdetail.step.purchasing') },
    { key: 'PURCHASED', label: t('orderdetail.step.purchased') },
    { key: 'CLOUDFLARE_PENDING', label: t('orderdetail.step.cloudflare') },
    { key: 'ONLINE', label: t('orderdetail.step.online') },
  ]), [t]);
  const fulfillment = order?.fulfillmentStatus || 'PURCHASING';
  const currentIndex = useMemo(() => statusSteps.findIndex((s) => s.key === fulfillment), [fulfillment, statusSteps]);
  const isPending = fulfillment !== 'ONLINE' && fulfillment !== 'FAILED';

  const fetchOrder = () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    api.get<Order>(`/orders/${id}`)
      .then(setOrder)
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrder();
  }, [id]);

  const handleCheck = async () => {
    if (!id) return;
    setChecking(true);
    setError(null);
    try {
      await api.post(`/orders/${id}/check`);
      fetchOrder();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setChecking(false);
    }
  };

  if (!id) {
    return <div className="text-zinc-400">{t('ordernew.invalid')}</div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('orderdetail.title')}</h1>
          <p className="text-sm text-zinc-500">{t('orderdetail.order', { id })}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/domains')}>{t('orderdetail.back')}</Button>
      </div>

      <Card>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">{t('ordernew.domain')}</span>
            <span className="text-white font-mono">{order?.domain || '--'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">{t('orderdetail.amount')}</span>
            <span className="text-white">${order?.amount?.toFixed(2) ?? '--'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">{t('orderdetail.status')}</span>
            <Badge variant={fulfillment === 'ONLINE' ? 'success' : fulfillment === 'FAILED' ? 'error' : 'warning'}>
              {fulfillment}
            </Badge>
          </div>
          {isPending && (
            <div className="text-xs text-amber-400">{t('orderdetail.pending')}</div>
          )}
        </div>
      </Card>

      <Card title={t('orderdetail.progress')}>
        <div className="space-y-3">
          {statusSteps.map((step, index) => {
            const reached = currentIndex >= index;
            const isCurrent = currentIndex === index;
            return (
              <div key={step.key} className="flex items-center gap-3">
                <div className={`h-2 w-2 rounded-full ${reached ? 'bg-emerald-400' : 'bg-zinc-700'}`} />
                <div className="flex items-center gap-2">
                  <span className={`text-sm ${reached ? 'text-white' : 'text-zinc-500'}`}>{step.label}</span>
                  {isCurrent && fulfillment !== 'ONLINE' && fulfillment !== 'FAILED' && (
                    <Badge variant="warning">{t('domains.pending')}</Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {error && <div className="text-sm text-amber-400">{error}</div>}

      <div className="flex items-center gap-3">
        <Button onClick={handleCheck} isLoading={checking} disabled={loading}>
          {t('orderdetail.check')}
        </Button>
        {loading && <span className="text-xs text-zinc-500">{t('orderdetail.refresh')}</span>}
      </div>
    </div>
  );
};
