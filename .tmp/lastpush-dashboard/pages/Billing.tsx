import React, { useEffect, useState } from 'react';
import { Card, Button, Badge } from '../components/ui/Common.tsx';
import { CreditCard, Download } from 'lucide-react';
import { api } from '../api.ts';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n.tsx';

const chainOptions = [
  { id: 1, label: 'ETH', tokens: ['USDT', 'USDC'] },
  { id: 56, label: 'BSC', tokens: ['USDT', 'USDC'] },
  { id: 42161, label: 'ARB', tokens: ['USDT', 'USDC'] },
  { id: 137, label: 'POLYGON', tokens: ['USDC'] },
  { id: 501, label: 'SOLANA', tokens: ['USDT', 'USDC'] },
  { id: 195, label: 'TRX', tokens: ['USDT'] },
  { id: 100060, label: 'TON', tokens: ['USDT'] },
];

export const Billing: React.FC = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [topUpAmount, setTopUpAmount] = useState('10');
  const [balance, setBalance] = useState(0);
  const [usage, setUsage] = useState({ bandwidthGB: 0, bandwidthLimitGB: 0, buildMinutes: 0, buildMinutesLimit: 0 });
  const [transactions, setTransactions] = useState<{ id: string; date: string; description: string; status: string; amount: number; invoiceUrl?: string }[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<{ id: string; brand: string; last4: string; expiresAt: string }[]>([]);
  const [showTopUp, setShowTopUp] = useState(false);
  const [selectedChainId, setSelectedChainId] = useState<number | null>(null);
  const [selectedToken, setSelectedToken] = useState<string>('USDT');
  const [paymentInfo, setPaymentInfo] = useState<{ orderId: string; depositAddress: string; chainId: number; token: string; amount: number } | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [confirmingPaid, setConfirmingPaid] = useState(false);
  const [confirmCountdown, setConfirmCountdown] = useState<number | null>(null);
  const [orderCountdown, setOrderCountdown] = useState<number | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ balance: number }>('/billing/balance')
      .then((res) => setBalance(res.balance))
      .catch(() => null);
    api.get<{ bandwidthGB: number; bandwidthLimitGB: number; buildMinutes: number; buildMinutesLimit: number }>('/billing/usage')
      .then(setUsage)
      .catch(() => null);
    api.get<{ items: { id: string; date: string; description: string; status: string; amount: number; invoiceUrl?: string }[] }>('/billing/transactions')
      .then((res) => setTransactions(res.items))
      .catch(() => null);
    api.get<{ items: { id: string; brand: string; last4: string; expiresAt: string }[] }>('/billing/payment-methods')
      .then((res) => setPaymentMethods(res.items))
      .catch(() => null);
  }, []);

  useEffect(() => {
    if (searchParams.get('topup') === '1') {
      setShowTopUp(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!selectedChainId) return;
    const chain = chainOptions.find((c) => c.id === selectedChainId);
    if (!chain) return;
    if (!chain.tokens.includes(selectedToken)) {
      setSelectedToken(chain.tokens[0]);
    }
  }, [selectedChainId, selectedToken]);

  useEffect(() => {
    if (!confirmingPaid) {
      setConfirmCountdown(null);
      return;
    }
    setConfirmCountdown(30);
    const timer = setInterval(() => {
      setConfirmCountdown((prev) => {
        if (prev === null) return prev;
        if (prev <= 1) {
          clearInterval(timer);
          setConfirmingPaid(false);
          navigate('/billing', { replace: true });
          window.location.reload();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [confirmingPaid, navigate]);

  useEffect(() => {
    if (!paymentInfo) {
      setOrderCountdown(null);
      return;
    }
    setOrderCountdown(1800);
    const timer = setInterval(() => {
      setOrderCountdown((prev) => {
        if (prev === null) return prev;
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [paymentInfo?.orderId]);

  const handleOpenTopUp = () => {
    setShowTopUp(true);
    setSelectedChainId(null);
    setSelectedToken('USDT');
    setPaymentInfo(null);
    setPaymentStatus(null);
    setConfirmingPaid(false);
    setOrderCountdown(null);
    setCopyStatus(null);
  };

  const handleSelectChain = async (id: number) => {
    if (selectedChainId === id && paymentInfo) return;
    setSelectedChainId(id);
    setPaymentInfo(null);
    setPaymentStatus(null);
  };

  const handlePlaceOrder = async () => {
    if (!selectedChainId || !selectedToken) return;
    setLoadingPayment(true);
    setPaymentStatus(null);
    try {
      const res = await api.post<{ orderId: string; depositAddress: string; chainId: number; token: string; amount: number }>(
        '/billing/top-up/crypto/order',
        {
          amount: Number(topUpAmount),
          chainId: selectedChainId,
          token: selectedToken,
        }
      );
      setPaymentInfo(res);
    } catch (err) {
      setPaymentStatus((err as Error).message);
    } finally {
      setLoadingPayment(false);
    }
  };

  const handleConfirmPaid = () => {
    if (!paymentInfo) return;
    setConfirmingPaid(true);
  };

  const handleCopyAddress = async () => {
    if (!paymentInfo) return;
    try {
      await navigator.clipboard.writeText(paymentInfo.depositAddress);
      setCopyStatus(t('billing.topup.copied'));
    } catch {
      setCopyStatus(t('billing.topup.copyfailed'));
    }
    setTimeout(() => setCopyStatus(null), 2000);
  };

  const formatCountdown = (totalSeconds: number | null) => {
    if (totalSeconds === null) return '';
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">{t('billing.title')}</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-indigo-900/20 to-zinc-900 border-indigo-500/20">
          <div className="p-2">
             <h3 className="text-zinc-400 text-sm font-medium">{t('billing.balance')}</h3>
             <div className="text-4xl font-bold text-white mt-2">${balance.toFixed(2)}</div>
             <div className="mt-4 flex gap-2">
               {['3', '10', '20', '100'].map(amt => (
                 <button 
                  key={amt}
                  onClick={() => setTopUpAmount(amt)}
                  className={`px-3 py-1 text-xs rounded-full border ${topUpAmount === amt ? 'bg-indigo-500 text-white border-indigo-500' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}
                 >
                   ${amt}
                 </button>
               ))}
             </div>
             <div className="mt-4 pt-4 border-t border-zinc-800/50">
               <Button className="w-full" onClick={handleOpenTopUp}>{t('billing.addfunds', { amount: topUpAmount })}</Button>
             </div>
          </div>
        </Card>

        <Card title={t('billing.usage')}>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-zinc-400">{t('billing.bandwidth')}</span>
                <span className="text-white">{usage.bandwidthGB} GB / {usage.bandwidthLimitGB} GB</span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500" style={{ width: `${usage.bandwidthLimitGB ? (usage.bandwidthGB / usage.bandwidthLimitGB) * 100 : 0}%` }}></div>
              </div>
            </div>
             <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-zinc-400">{t('billing.buildminutes')}</span>
                <span className="text-white">{usage.buildMinutes} / {usage.buildMinutesLimit}</span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: `${usage.buildMinutesLimit ? (usage.buildMinutes / usage.buildMinutesLimit) * 100 : 0}%` }}></div>
              </div>
            </div>
          </div>
        </Card>

        <Card title={t('billing.paymentmethod')}>
           {paymentMethods[0] ? (
             <div className="flex items-center gap-3 p-3 bg-zinc-900 rounded-lg border border-zinc-800 mb-4">
               <CreditCard className="w-8 h-8 text-zinc-500" />
               <div>
                 <div className="text-sm font-medium text-white">{paymentMethods[0].brand} •••• {paymentMethods[0].last4}</div>
                 <div className="text-xs text-zinc-500">Expires {paymentMethods[0].expiresAt}</div>
               </div>
             </div>
           ) : (
             <div className="text-xs text-zinc-500 mb-4">{t('billing.nopayment')}</div>
           )}
           <Button variant="outline" size="sm" className="w-full">{t('billing.managecards')}</Button>
        </Card>
      </div>

      <div className="mt-8">
        <h3 className="text-lg font-medium text-white mb-4">{t('billing.transactions')}</h3>
        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          <table className="w-full text-left text-sm text-zinc-400">
            <thead className="bg-zinc-900 text-zinc-200">
              <tr>
                <th className="px-6 py-3">{t('billing.date')}</th>
                <th className="px-6 py-3">{t('billing.description')}</th>
                <th className="px-6 py-3">{t('billing.status')}</th>
                <th className="px-6 py-3 text-right">{t('billing.amount')}</th>
                <th className="px-6 py-3 text-right">{t('billing.invoice')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 bg-zinc-900/30">
              {transactions.map((tx, i) => (
                <tr key={i}>
                  <td className="px-6 py-4">{tx.date}</td>
                  <td className="px-6 py-4 text-white">{tx.description}</td>
                  <td className="px-6 py-4">
                    {tx.status === 'PAID' ? <Badge variant="success">{t('billing.paid')}</Badge> : <Badge variant="error">{t('billing.failed')}</Badge>}
                  </td>
                  <td className={`px-6 py-4 text-right font-mono ${tx.amount > 0 ? 'text-emerald-400' : 'text-zinc-200'}`}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {tx.invoiceUrl ? (
                      <a href={tx.invoiceUrl} target="_blank" className="text-zinc-500 hover:text-white">
                        <Download className="w-4 h-4" />
                      </a>
                    ) : (
                      <span className="text-zinc-700"><Download className="w-4 h-4" /></span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showTopUp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">{t('billing.topup.title')}</h3>
              <button
                className="text-zinc-500 hover:text-zinc-200"
                onClick={() => setShowTopUp(false)}
              >
                {t('billing.topup.close')}
              </button>
            </div>

              <div className="space-y-4">
              <div>
                <div className="text-xs font-medium text-zinc-400 mb-2">{t('billing.topup.chain')}</div>
                <div className="flex flex-wrap gap-2">
                  {chainOptions.map((chain) => (
                    <Button
                      key={chain.id}
                      size="sm"
                      variant={selectedChainId === chain.id ? 'primary' : 'outline'}
                      onClick={() => handleSelectChain(chain.id)}
                    >
                      {chain.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-medium text-zinc-400 mb-2">{t('billing.topup.token')}</div>
                <div className="flex flex-wrap gap-2">
                  {(chainOptions.find((c) => c.id === selectedChainId)?.tokens || ['USDT']).map((token) => (
                    <Button
                      key={token}
                      size="sm"
                      variant={selectedToken === token ? 'primary' : 'outline'}
                      onClick={() => {
                        setSelectedToken(token);
                        setPaymentInfo(null);
                        setPaymentStatus(null);
                      }}
                    >
                      {token}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                {loadingPayment && <span className="text-xs text-zinc-500">{t('billing.topup.loading')}</span>}
              </div>

              {!paymentInfo && (
                <Button
                  className="w-full"
                  disabled={!selectedChainId || !selectedToken || loadingPayment}
                  isLoading={loadingPayment}
                  onClick={handlePlaceOrder}
                >
                  {t('billing.topup.placeorder')}
                </Button>
              )}

              {paymentInfo && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 text-sm text-zinc-400 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="break-all">{t('billing.topup.deposit', { address: paymentInfo.depositAddress })}</span>
                      <Button size="sm" variant="outline" onClick={handleCopyAddress}>{t('billing.topup.copy')}</Button>
                    </div>
                    {copyStatus && <div className="text-xs text-emerald-400">{copyStatus}</div>}
                    <div>{t('billing.topup.tokenlabel', { token: paymentInfo.token })}</div>
                    <div>{t('billing.topup.amount', { amount: paymentInfo.amount })}</div>
                    <div>{t('billing.topup.network', { network: chainOptions.find((c) => c.id === paymentInfo.chainId)?.label || '' })}</div>
                    {orderCountdown !== null && (
                      <div className="text-xs text-amber-400">
                        {t('billing.topup.ordercountdown', { seconds: formatCountdown(orderCountdown) })}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-center">
                    <img
                      alt={t('billing.topup.qr')}
                      className="h-40 w-40 rounded-lg border border-zinc-800 bg-zinc-950/60"
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                        `${paymentInfo.token}:${paymentInfo.amount}@${paymentInfo.depositAddress}`
                      )}`}
                    />
                  </div>
                  <Button className="w-full" onClick={handleConfirmPaid} disabled={confirmingPaid}>
                    {confirmingPaid ? t('billing.topup.confirming') : t('billing.topup.confirm')}
                  </Button>
                  {confirmingPaid && confirmCountdown !== null && (
                    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 flex flex-col items-center gap-3">
                      <div className="h-8 w-8 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
                      <div className="text-sm text-zinc-300">{t('billing.topup.confirmcountdown', { seconds: formatCountdown(confirmCountdown) })}</div>
                    </div>
                  )}
                </div>
              )}

              {paymentStatus && (
                <div className="text-xs text-amber-400">{paymentStatus}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
