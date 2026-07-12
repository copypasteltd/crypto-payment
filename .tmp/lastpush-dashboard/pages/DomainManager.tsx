import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Globe, ShieldCheck, ArrowRight } from 'lucide-react';
import { Button, Card, Badge } from '../components/ui/Common.tsx';
import { Domain, DNSRecord, DomainSummary } from '../types.ts';
import { api } from '../api.ts';
import { useI18n } from '../i18n.tsx';

// --- Sub-component: DNS Editor ---
const DNSEditor: React.FC<{ domainName: string; initialRecords: DNSRecord[]; recordLimit?: number }> = ({ domainName, initialRecords, recordLimit }) => {
  const { t } = useI18n();
  const [records, setRecords] = useState(initialRecords);
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [newRecordId, setNewRecordId] = useState<string | null>(null);
  const remainingRecords = recordLimit === undefined ? null : Math.max(recordLimit - records.length, 0);
  const canAddRecord = recordLimit === undefined ? true : records.length < recordLimit;

  useEffect(() => {
    setRecords(initialRecords);
    setDirtyIds(new Set());
    setSavingIds(new Set());
    setNewRecordId(null);
  }, [initialRecords]);

  const markDirty = (id: string) => {
    setDirtyIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const clearDirty = (id: string) => {
    setDirtyIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const markSaving = (id: string, saving: boolean) => {
    setSavingIds((prev) => {
      const next = new Set(prev);
      if (saving) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleDelete = async (id: string) => {
    if (newRecordId && id === newRecordId) {
      setRecords((prev) => prev.filter((r) => r.id !== id));
      setNewRecordId(null);
      clearDirty(id);
      return;
    }
    markSaving(id, true);
    try {
      await api.del(`/domains/${domainName}/dns/records/${id}`);
      setRecords((prev) => prev.filter((r) => r.id !== id));
      clearDirty(id);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      markSaving(id, false);
    }
  };

  const handleUpdate = <K extends keyof DNSRecord>(id: string, key: K, value: DNSRecord[K]) => {
    setRecords((prev) =>
      prev.map((record) => (record.id === id ? { ...record, [key]: value } : record))
    );
    markDirty(id);
  };

  const handleAdd = () => {
    if (!canAddRecord || newRecordId) return;
    const tempId = `new-${Date.now()}`;
    const newRecord: DNSRecord = {
      id: tempId,
      type: 'A',
      name: '',
      content: '',
      ttl: 60,
      proxied: false
    };
    setRecords([...records, newRecord]);
    setNewRecordId(tempId);
    markDirty(tempId);
  };

  const handleSave = async (record: DNSRecord) => {
    markSaving(record.id, true);
    try {
      if (newRecordId && record.id === newRecordId) {
        const created = await api.post<DNSRecord>(`/domains/${domainName}/dns/records`, {
          type: record.type,
          name: record.name,
          content: record.content,
          ttl: record.ttl,
          proxied: record.proxied,
        });
        setRecords((prev) => prev.map((r) => (r.id === record.id ? created : r)));
        clearDirty(record.id);
        setNewRecordId(null);
      } else {
        const updated = await api.patch<DNSRecord>(`/domains/${domainName}/dns/records/${record.id}`, {
          type: record.type,
          name: record.name,
          content: record.content,
          ttl: record.ttl,
          proxied: record.proxied,
        });
        setRecords((prev) => prev.map((r) => (r.id === record.id ? updated : r)));
        clearDirty(record.id);
      }
    } catch (err) {
      alert((err as Error).message);
    } finally {
      markSaving(record.id, false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-lg font-medium text-white">{t('domains.dns.title')}</h3>
          {remainingRecords !== null && (
            <div className="text-xs text-zinc-500 mt-1">
              {t('domains.dns.remaining', { remaining: remainingRecords, limit: recordLimit || 0 })}
            </div>
          )}
        </div>
        <Button size="sm" onClick={handleAdd} disabled={!canAddRecord || !!newRecordId}>
          <Plus className="w-4 h-4 mr-2" />{t('domains.dns.add')}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full text-left text-sm text-zinc-400">
          <thead className="bg-zinc-900 text-zinc-200 uppercase text-xs font-semibold">
            <tr>
              <th className="px-4 py-3 w-24">{t('domains.dns.type')}</th>
              <th className="px-4 py-3 w-48">{t('domains.dns.name')}</th>
              <th className="px-4 py-3">{t('domains.dns.content')}</th>
              <th className="px-4 py-3 w-24">{t('domains.dns.ttl')}</th>
              <th className="px-4 py-3 w-24">{t('domains.dns.proxy')}</th>
              <th className="px-4 py-3 w-16"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800 bg-zinc-900/30">
            {records.map((rec) => (
              <tr key={rec.id} className="hover:bg-zinc-900/50">
                <td className="px-4 py-3">
                  <select
                    className="h-9 w-full rounded-lg border border-zinc-700 bg-zinc-900/70 px-2 text-xs text-zinc-200"
                    value={rec.type}
                    onChange={(e) => handleUpdate(rec.id, 'type', e.target.value as DNSRecord['type'])}
                  >
                    {['A', 'CNAME', 'TXT', 'MX', 'URI'].map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <input
                    className="h-9 w-full rounded-lg border border-zinc-700 bg-zinc-900/70 px-3 text-xs text-zinc-200 font-mono"
                    value={rec.name}
                    onChange={(e) => handleUpdate(rec.id, 'name', e.target.value)}
                    placeholder="@"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    className="h-9 w-full rounded-lg border border-zinc-700 bg-zinc-900/70 px-3 text-xs text-zinc-200 font-mono"
                    value={rec.content}
                    onChange={(e) => handleUpdate(rec.id, 'content', e.target.value)}
                    placeholder={rec.type === 'MX' ? 'priority mail.example.com' : rec.type === 'URI' ? 'priority weight target' : ''}
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    className="h-9 w-20 rounded-lg border border-zinc-700 bg-zinc-900/70 px-2 text-xs text-zinc-200"
                    type="number"
                    min={0}
                    value={rec.ttl}
                    onChange={(e) => handleUpdate(rec.id, 'ttl', Number(e.target.value))}
                  />
                </td>
                <td className="px-4 py-3">
                  <label className="flex items-center gap-2 text-xs text-zinc-500">
                    <input
                      type="checkbox"
                      className="accent-indigo-500"
                      checked={rec.proxied}
                      onChange={(e) => handleUpdate(rec.id, 'proxied', e.target.checked)}
                    />
                    {rec.proxied ? <Badge variant="warning">{t('domains.dns.proxied')}</Badge> : <Badge variant="neutral">{t('domains.dns.dnsonly')}</Badge>}
                  </label>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!dirtyIds.has(rec.id) || savingIds.has(rec.id)}
                      onClick={() => handleSave(rec)}
                    >
                      {savingIds.has(rec.id) ? t('domains.dns.saving') : t('domains.dns.save')}
                    </Button>
                    <button onClick={() => handleDelete(rec.id)} className="text-zinc-600 hover:text-red-400" disabled={savingIds.has(rec.id)}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {records.length === 0 && <div className="p-8 text-center text-zinc-500">{t('domains.dns.none')}</div>}
      </div>
    </div>
  );
};

// --- Page: Domain Detail ---
export const DomainDetail: React.FC = () => {
  const { t } = useI18n();
  const { name } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'dns'>('overview');
  const [domain, setDomain] = useState<Domain | null>(null);

  if (!name) return <div>{t('domains.detail.invalid')}</div>;

  useEffect(() => {
    api.get<Domain>(`/domains/${name}`)
      .then(setDomain)
      .catch(() => null);
  }, [name]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/domains')} className="-ml-2">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-white font-mono">{name}</h1>
          <div className="flex items-center gap-2 mt-1 text-sm text-zinc-500">
            <span className={`flex items-center gap-1 ${domain?.registrarStatus === 'Ok' ? 'text-emerald-400' : 'text-amber-400'}`}>
              <ShieldCheck className="w-3 h-3" />
              {domain?.registrarStatus === 'Ok' ? t('domains.active') : domain?.registrarStatus || 'Unknown'}
            </span>
            <span>/</span>
            <span>{t('domains.detail.expires', { date: domain?.expiresAt || '--' })}</span>
          </div>
        </div>
      </div>

      <div className="border-b border-zinc-800 flex gap-6 text-sm font-medium">
        <button 
          onClick={() => setActiveTab('overview')}
          className={`pb-3 ${activeTab === 'overview' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-zinc-500 hover:text-white'}`}
        >
          {t('domains.detail.overview')}
        </button>
        <button 
          onClick={() => setActiveTab('dns')}
          className={`pb-3 ${activeTab === 'dns' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-zinc-500 hover:text-white'}`}
        >
          {t('domains.detail.dns')}
        </button>
      </div>

      {activeTab === 'overview' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card title={t('domains.detail.registration')} className="h-full">
            <div className="space-y-4">
              <div className="flex justify-between py-2 border-b border-zinc-800/50">
                <span className="text-zinc-500">{t('domains.detail.autorenew')}</span>
                <span className="text-white font-medium">{domain?.autoRenew ? 'On' : 'Off'}</span>
              </div>
              <div className="pt-2">
                 <Button variant="outline" className="w-full">{t('domains.detail.manage')}</Button>
              </div>
            </div>
          </Card>
          <Card title={t('domains.detail.ssl')} className="h-full">
            <div className="flex flex-col items-center justify-center h-48 space-y-3">
               <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
                 <ShieldCheck className="w-8 h-8 text-emerald-500" />
               </div>
               <h3 className="text-white font-medium">
                 {domain?.sslStatus === 'ACTIVE' ? t('domains.detail.sslactive') : t('domains.detail.sslpending')}
               </h3>
               <p className="text-zinc-500 text-center text-sm px-8">{t('domains.detail.sslcopy')}</p>
            </div>
          </Card>
        </div>
      ) : (
        <DNSEditor domainName={name} initialRecords={domain?.records || []} recordLimit={domain?.recordLimit} />
      )}
    </div>
  );
};

// --- Page: Domain List ---
export const DomainList: React.FC = () => {
  const { t } = useI18n();
  const [domains, setDomains] = useState<DomainSummary[]>([]);

  useEffect(() => {
    api.get<{ items: DomainSummary[] }>('/domains')
      .then((res) => setDomains(res.items))
      .catch(() => null);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">{t('domains.title')}</h1>
        <div className="flex gap-2">
          <Link to="/domains/search">
            <Button><Plus className="w-4 h-4 mr-2" /> {t('domains.buy')}</Button>
          </Link>
        </div>
      </div>

      {domains.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-8 text-center">
          <div className="text-lg font-medium text-white mb-2">{t('domains.empty.title')}</div>
          <div className="text-sm text-zinc-500 mb-6">{t('domains.empty.subtitle')}</div>
          <div className="flex items-center justify-center gap-3">
            <Link to="/">
              <Button>{t('domains.buy')}</Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          <div className="grid grid-cols-1 divide-y divide-zinc-800 bg-zinc-900/30">
            {domains.map(domain => {
              const badgeVariant =
                domain.registrarStatus === 'Ok' ? 'success' :
                domain.registrarStatus === 'Pending' ? 'warning' : 'error';
              const badgeLabel =
                domain.registrarStatus === 'Ok' ? 'Active' :
                domain.registrarStatus === 'Pending' ? 'Pending' : 'Hold';
              return (
              <Link key={domain.name} to={`/domains/${domain.name}`} className="p-4 hover:bg-zinc-900/50 transition-colors flex items-center justify-between group">
                 <div className="flex items-center gap-4">
                   <div className="p-2 bg-zinc-800 rounded-lg"><Globe className="w-5 h-5 text-zinc-400" /></div>
                   <div>
                     <div className="font-mono font-medium text-zinc-200">{domain.name}</div>
                     <div className="text-xs text-zinc-500">{t('domains.autorenews', { date: domain.expiresAt })}</div>
                   </div>
                 </div>
                 <div className="flex items-center gap-4">
                   <Badge variant={badgeVariant}>
                     {badgeLabel === 'Active' ? t('domains.active') : badgeLabel === 'Pending' ? t('domains.pending') : t('domains.hold')}
                   </Badge>
                   <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400" />
                 </div>
              </Link>
            );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
