import React, { useEffect, useState } from 'react';
import { Card, Button, Input, Badge } from '../components/ui/Common.tsx';
import { useAuth } from '../App.tsx';
import { ShieldCheck, Bell, KeyRound, Trash2 } from 'lucide-react';
import { api } from '../api.ts';
import { User } from '../types.ts';
import { useI18n } from '../i18n.tsx';

export const Settings: React.FC = () => {
  const { user, updateUser } = useAuth();
  const { t } = useI18n();
  const [handle, setHandle] = useState(user?.handle || '');
  const [email, setEmail] = useState(user?.email || '');
  const [saving, setSaving] = useState(false);
  const [notifications, setNotifications] = useState({
    deploys: true,
    billing: true,
    security: false,
  });
  const [apiKeys, setApiKeys] = useState<{ id: string; label: string; prefix: string; last4: string }[]>([]);
  const [keyLabel, setKeyLabel] = useState('');
  const [planName, setPlanName] = useState<string | null>(null);
  const [sitesCount, setSitesCount] = useState(0);
  const [domainsCount, setDomainsCount] = useState(0);
  const [usage, setUsage] = useState({ bandwidthGB: 0, bandwidthLimitGB: 0, buildMinutes: 0, buildMinutesLimit: 0 });

  useEffect(() => {
    setHandle(user?.handle || '');
    setEmail(user?.email || '');
  }, [user]);

  useEffect(() => {
    api.get<{ deploys: boolean; billing: boolean; security: boolean }>('/notifications/preferences')
      .then(setNotifications)
      .catch(() => null);
    api.get<{ items: { id: string; label: string; prefix: string; last4: string }[] }>('/api-keys')
      .then((res) => setApiKeys(res.items))
      .catch(() => null);
    api.get<{ items: { id: string }[] }>('/sites')
      .then((res) => setSitesCount(res.items.length))
      .catch(() => null);
    api.get<{ items: { name: string }[] }>('/domains')
      .then((res) => setDomainsCount(res.items.length))
      .catch(() => null);
    api.get<{ bandwidthGB: number; bandwidthLimitGB: number; buildMinutes: number; buildMinutesLimit: number }>('/billing/usage')
      .then(setUsage)
      .catch(() => null);
    api.get<{ plan?: string }>('/users/me')
      .then((res) => setPlanName(res.plan || null))
      .catch(() => null);
  }, []);

  const handleSaveProfile = () => {
    if (!user) return;
    setSaving(true);
    api.patch<User>('/users/me', {
      handle: handle.trim() || user.handle,
      email: email.trim() || user.email,
    })
      .then((updated) => {
        updateUser(updated);
      })
      .finally(() => setSaving(false));
  };

  const handleToggle = (key: keyof typeof notifications) => {
    const next = { ...notifications, [key]: !notifications[key] };
    setNotifications(next);
    api.patch('/notifications/preferences', next).catch(() => null);
  };

  const handleCreateKey = () => {
    const label = keyLabel.trim();
    if (!label) return;
    api.post<{ id: string; label: string; token?: string; prefix?: string; last4?: string }>('/api-keys', { label })
      .then((res) => {
        setApiKeys((prev) => [
          { id: res.id, label: res.label, prefix: res.prefix || 'lp_', last4: res.last4 || '****' },
          ...prev,
        ]);
        setKeyLabel('');
      })
      .catch(() => null);
  };

  const handleRotateKey = (id: string) => {
    api.post<{ id: string; prefix?: string; last4?: string }>(`/api-keys/${id}/rotate`)
      .then((res) => {
        setApiKeys((prev) =>
          prev.map((k) =>
            k.id === id ? { ...k, prefix: res.prefix || k.prefix, last4: res.last4 || k.last4 } : k
          )
        );
      })
      .catch(() => null);
  };

  const handleDeleteWorkspace = () => {
    if (!confirm(t('settings.deletewarn'))) return;
    api.del('/workspace').catch(() => null);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">{t('settings.title')}</h1>
        <p className="text-sm text-zinc-500">{t('settings.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2" title={t('settings.profile')}>
          <div className="space-y-4">
            <Input label={t('settings.displayname')} value={handle} onChange={(e) => setHandle(e.target.value)} />
            <Input label={t('settings.email')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <div className="flex items-center gap-3 text-sm text-zinc-500">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              {t('settings.walletenabled', { suffix: user?.walletAddress ? `(${user.walletAddress.slice(0, 6)}...)` : '' })}
            </div>
            <Button onClick={handleSaveProfile} isLoading={saving}>{t('settings.save')}</Button>
          </div>
        </Card>

        <Card title={t('settings.plan')}>
          <div className="space-y-4 text-sm text-zinc-400">
            <div className="flex items-center justify-between">
              <span>{t('settings.currentplan')}</span>
              <Badge variant="info">{planName || '--'}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>{t('settings.projects')}</span>
              <span className="text-white">{sitesCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>{t('settings.domains')}</span>
              <span className="text-white">{domainsCount}</span>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-zinc-500">{t('billing.bandwidth')}</span>
                <span className="text-white">{usage.bandwidthGB} / {usage.bandwidthLimitGB} GB</span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500" style={{ width: `${usage.bandwidthLimitGB ? (usage.bandwidthGB / usage.bandwidthLimitGB) * 100 : 0}%` }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-zinc-500">{t('billing.buildminutes')}</span>
                <span className="text-white">{usage.buildMinutes} / {usage.buildMinutesLimit}</span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: `${usage.buildMinutesLimit ? (usage.buildMinutes / usage.buildMinutesLimit) * 100 : 0}%` }}></div>
              </div>
            </div>
            <Button variant="outline" size="sm" className="w-full">{t('settings.upgrade')}</Button>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2" title={t('settings.notifications')}>
          <div className="space-y-3">
            {[
              { key: 'deploys', label: t('settings.notify.deploys') },
              { key: 'billing', label: t('settings.notify.billing') },
              { key: 'security', label: t('settings.notify.security') },
            ].map((item) => (
              <label key={item.key} className="flex items-center justify-between p-3 rounded-lg border border-zinc-800 bg-zinc-900/30">
                <span className="text-sm text-zinc-300 flex items-center gap-2">
                  <Bell className="w-4 h-4 text-zinc-500" />
                  {item.label}
                </span>
                <input
                  type="checkbox"
                  className="accent-indigo-500"
                  checked={notifications[item.key as keyof typeof notifications]}
                  onChange={() => handleToggle(item.key as keyof typeof notifications)}
                />
              </label>
            ))}
          </div>
        </Card>

        <Card title={t('settings.apikeys')}>
          <div className="space-y-4 text-sm text-zinc-400">
            {apiKeys.length === 0 && (
              <div className="text-xs text-zinc-500">{t('settings.nokeys')}</div>
            )}
            {apiKeys.map((key) => (
              <div key={key.id} className="flex items-center justify-between">
                <span>{key.label}</span>
                <span className="font-mono text-zinc-200">{key.prefix}{key.last4}</span>
              </div>
            ))}
            <div className="flex gap-2">
              <Input placeholder={t('settings.keylabel')} value={keyLabel} onChange={(e) => setKeyLabel(e.target.value)} />
              <Button variant="outline" size="sm" onClick={handleCreateKey}>{t('settings.create')}</Button>
            </div>
            {apiKeys[0] && (
              <Button variant="outline" size="sm" className="w-full" onClick={() => handleRotateKey(apiKeys[0].id)}>
                <KeyRound className="w-4 h-4 mr-2" />{t('settings.rotate')}
              </Button>
            )}
          </div>
        </Card>
      </div>

      <Card title={t('settings.danger')} className="border-red-500/20">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="text-sm text-zinc-400">{t('settings.deleteworkspace')}</div>
            <div className="text-xs text-zinc-600">{t('settings.deletewarn')}</div>
          </div>
          <Button variant="danger" onClick={handleDeleteWorkspace}><Trash2 className="w-4 h-4 mr-2" />{t('settings.delete')}</Button>
        </div>
      </Card>
    </div>
  );
};










