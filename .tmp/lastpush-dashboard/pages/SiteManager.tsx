import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { UploadCloud, File, Globe, Clock, CheckCircle, Plus } from 'lucide-react';
import { Button, Input, Card, Badge } from '../components/ui/Common.tsx';
import { Deployment, Site, SiteSummary, DomainSummary } from '../types.ts';
import { api } from '../api.ts';
import { useI18n } from '../i18n.tsx';

// --- Page: New Site ---
export const NewSite: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const maxBundleSize = 50 * 1024 * 1024;
  const allowedExtensions = ['.zip', '.tar.gz', '.7z', '.rar'];
  const [file, setFile] = useState<File | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [deployStatus, setDeployStatus] = useState<'upload' | 'building' | 'success'>('upload');
  const [deployedSiteId, setDeployedSiteId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [defaultDomains, setDefaultDomains] = useState<string[]>([]);
  const [userDomains, setUserDomains] = useState<string[]>([]);
  const [domainChoice, setDomainChoice] = useState('default');
  const [domainPrefix, setDomainPrefix] = useState('');
  const [checkingDomain, setCheckingDomain] = useState(false);
  const [domainAvailable, setDomainAvailable] = useState<boolean | null>(null);
  const [domainCheckMessage, setDomainCheckMessage] = useState<string | null>(null);
  const [recordLimit, setRecordLimit] = useState<number | null>(null);
  const [recordUsed, setRecordUsed] = useState<number | null>(null);
  const secondaryDomains = defaultDomains.slice(1);
  const selectableDomains = useMemo(() => {
    const items = [...secondaryDomains, ...userDomains];
    return Array.from(new Set(items.filter(Boolean)));
  }, [secondaryDomains, userDomains]);

  useEffect(() => {
    api.get<{ items: string[] }>('/domains/defaults')
      .then((res) => setDefaultDomains(res.items))
      .catch(() => null);
  }, []);

  useEffect(() => {
    api.get<{ items: DomainSummary[] }>('/domains')
      .then((res) => setUserDomains(res.items.map((domain) => domain.name)))
      .catch(() => null);
  }, []);

  useEffect(() => {
    setDomainAvailable(null);
    setDomainCheckMessage(null);
    setRecordLimit(null);
    setRecordUsed(null);
  }, [domainChoice, domainPrefix]);

  useEffect(() => {
    if (!deploying) {
      setCountdown(null);
      return;
    }
    setCountdown(60);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null) return prev;
        if (prev <= 1) {
          clearInterval(timer);
          setDeploying(false);
          navigate('/sites');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [deploying, navigate]);

  const handleCheckDomain = async () => {
    if (!domainPrefix.trim()) return;
    if (domainChoice !== 'default' && !domainChoice) return;
    if (domainChoice === 'default' && defaultDomains.length === 0) return;

    setCheckingDomain(true);
    setDomainAvailable(null);
    setDomainCheckMessage(null);
    try {
      const res = await api.post<{ available: boolean; message?: string; recordLimit?: number; recordUsed?: number }>('/domains/defaults/check', {
        prefix: domainPrefix.trim(),
        baseDomain: domainChoice === 'default' ? undefined : domainChoice,
      });
      setDomainAvailable(res.available);
      setDomainCheckMessage(res.message || (res.available ? 'Available' : 'Unavailable'));
      setRecordLimit(typeof res.recordLimit === 'number' ? res.recordLimit : null);
      setRecordUsed(typeof res.recordUsed === 'number' ? res.recordUsed : null);
    } catch (err) {
      setDomainAvailable(false);
      setDomainCheckMessage((err as Error).message);
      setRecordLimit(null);
      setRecordUsed(null);
    } finally {
      setCheckingDomain(false);
    }
  };

  const handleDeploy = async () => {
    if (!file) return;
    setDeploying(true);
    setDeployStatus('building');
    setDeployedSiteId(null);

    const form = new FormData();
    const derivedName = (() => {
      if (name.trim()) return name.trim();
      if (file) {
        return file.name.replace(/\W+/g, '-').toLowerCase();
      }
      return 'site';
    })();

    if (file) {
      form.append('bundle', file);
    }
    form.append('name', derivedName);
    form.append('domainPrefix', domainPrefix.trim());
    if (domainChoice !== 'default') {
      form.append('baseDomain', domainChoice);
    }

    try {
      const res = await api.upload<{ siteId: string; deploymentId: string }>('/sites', form);
      setDeployStatus('success');
      setDeployedSiteId(res.siteId);
    } catch (err) {
      alert((err as Error).message);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">{t('sites.deploy.title')}</h1>
        <p className="text-zinc-400">{t('sites.deploy.subtitle')}</p>
      </div>

      <Card>
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <span className="uppercase tracking-wide text-xs text-zinc-500">{t('sites.deploy.status.label')}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              deployStatus === 'success' ? 'bg-emerald-500/10 text-emerald-400' :
              deployStatus === 'building' ? 'bg-amber-500/10 text-amber-400' :
              'bg-zinc-800 text-zinc-300'
            }`}>
              {deployStatus === 'success'
                ? t('sites.deploy.status.success')
                : deployStatus === 'building'
                ? t('sites.deploy.status.building')
                : t('sites.deploy.status.upload')}
            </span>
          </div>
          <div className="border-2 border-dashed border-zinc-700 rounded-xl p-8 text-center hover:bg-zinc-800/30 transition-colors cursor-pointer relative">
            <input 
              type="file" 
              className="absolute inset-0 opacity-0 cursor-pointer" 
              onChange={(e) => {
                const nextFile = e.target.files?.[0] || null;
                if (nextFile) {
                  const lowerName = nextFile.name.toLowerCase();
                  const isAllowed = allowedExtensions.some((ext) => lowerName.endsWith(ext));
                  if (!isAllowed) {
                    alert(t('sites.deploy.filetype', { types: 'zip, tar.gz, 7z, rar' }));
                    e.target.value = '';
                    setFile(null);
                    return;
                  }
                }
                if (nextFile && nextFile.size > maxBundleSize) {
                  alert(t('sites.deploy.filesize', { size: '50MB' }));
                  e.target.value = '';
                  setFile(null);
                  return;
                }
                setFile(nextFile);
              }}
              accept=".zip,.tar.gz,.7z,.rar"
            />
            <div className="flex flex-col items-center gap-3">
              <div className="p-3 bg-indigo-500/10 rounded-full text-indigo-400">
                {file ? <File className="w-8 h-8" /> : <UploadCloud className="w-8 h-8" />}
              </div>
              <div>
                <p className="font-medium text-zinc-200">{file ? file.name : t('sites.deploy.drag')}</p>
                <p className="text-sm text-zinc-500 mt-1">{file ? `${(file.size / 1024).toFixed(1)} KB` : t('sites.deploy.support')}</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
             <Input label={t('sites.deploy.project')} placeholder="my-awesome-project" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">{t('sites.deploy.domain')}</label>
                <select
                  className="flex h-10 w-full rounded-lg border border-zinc-700 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                  value={domainChoice}
                  onChange={(e) => setDomainChoice(e.target.value)}
                >
                  <option value="default">{t('sites.deploy.defaultdomain')} (Default)</option>
                  {selectableDomains.map((domain) => (
                    <option key={domain} value={domain}>{domain}</option>
                  ))}
                </select>
                {domainChoice === 'default' && defaultDomains.length === 0 && (
                  <div className="mt-2 text-xs text-amber-400">{t('sites.deploy.nodomain')}</div>
                )}
              </div>
              <Input
                label={t('sites.deploy.prefix')}
                placeholder="my-site"
                value={domainPrefix}
                onChange={(e) => setDomainPrefix(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                variant="outline"
                disabled={
                  checkingDomain ||
                  !domainPrefix.trim() ||
                  (domainChoice === 'default' && defaultDomains.length === 0)
                }
                onClick={handleCheckDomain}
              >
                {checkingDomain ? t('sites.deploy.checking') : t('sites.deploy.check')}
              </Button>
              {domainCheckMessage && (
                <span className={`text-sm ${domainAvailable ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {domainCheckMessage}
                </span>
              )}
              {recordLimit !== null && recordUsed !== null && (
                <span className="text-xs text-zinc-500">
                  {t('sites.deploy.remaining', { remaining: Math.max(recordLimit - recordUsed, 0), limit: recordLimit })}
                </span>
              )}
            </div>
          </div>

          {!deploying && deployStatus !== 'success' ? (
            <Button
              className="w-full h-12 text-base"
              disabled={
                domainAvailable !== true ||
                (recordLimit !== null && recordUsed !== null && recordLimit - recordUsed <= 0) ||
                !file
              }
              onClick={handleDeploy}
            >
              {t('sites.deploy.deploy')}
            </Button>
          ) : null}
          {deploying && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-6 flex flex-col items-center gap-3">
              <div className="h-10 w-10 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
              <div className="text-zinc-200 font-medium">{t('sites.deploy.building')}</div>
              {countdown !== null && (
                <div className="text-sm text-zinc-400">{t('sites.deploy.countdown', { seconds: countdown })}</div>
              )}
            </div>
          )}
          {deployStatus === 'success' && countdown === 0 && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 flex flex-col gap-3">
              <div className="text-emerald-400 font-semibold">{t('sites.deploy.success')}</div>
              {deployedSiteId && (
                <Button onClick={() => navigate(`/sites/${deployedSiteId}`)}>
                  {t('sites.deploy.viewsite')}
                </Button>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

// --- Page: Site List ---
export const SiteList: React.FC = () => {
  const { t } = useI18n();
  const [sites, setSites] = useState<SiteSummary[]>([]);

  useEffect(() => {
    api.get<{ items: SiteSummary[] }>('/sites')
      .then((res) => setSites(res.items))
      .catch(() => null);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">{t('sites.title')}</h1>
        <Link to="/sites/new"><Button><Plus className="w-4 h-4 mr-2" /> {t('sites.newproject')}</Button></Link>
      </div>

      {sites.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-8 text-center">
          <div className="text-lg font-medium text-white mb-2">{t('sites.empty.title')}</div>
          <div className="text-sm text-zinc-500 mb-6">{t('sites.empty.subtitle')}</div>
          <Link to="/sites/new">
            <Button>{t('sites.empty.cta')}</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sites.map((site) => (
            <Link key={site.id} to={`/sites/${site.id}`} className="group block">
              <Card className="h-full hover:border-zinc-600 transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center font-bold text-indigo-400">
                      LP
                    </div>
                    <div>
                      <h3 className="font-semibold text-white group-hover:text-indigo-400 transition-colors">{site.name}</h3>
                      <p className="text-xs text-zinc-500">{site.domain}</p>
                    </div>
                  </div>
                  <Badge variant="success">{site.status}</Badge>
                </div>
                <div className="space-y-2 text-xs text-zinc-400">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3 h-3" />
                    <span>Deployed {new Date(site.lastDeployedAt).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Globe className="w-3 h-3" />
                    <span>{site.framework}</span>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

// --- Page: Site Detail ---
export const SiteDetail: React.FC = () => {
  const { t } = useI18n();
  const { id } = useParams();
  const navigate = useNavigate();
  const [site, setSite] = useState<Site | null>(null);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [domains, setDomains] = useState<{ domain: string; type: string }[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [deleteCountdown, setDeleteCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;
    api.get<Site>(`/sites/${id}`)
      .then((res) => setSite(res))
      .catch(() => null);
    api.get<{ items: Deployment[] }>(`/sites/${id}/deployments`)
      .then((res) => setDeployments(res.items))
      .catch(() => null);
    api.get<{ items: { domain: string; type: string }[] }>(`/sites/${id}/domains`)
      .then((res) => setDomains(res.items))
      .catch(() => null);
  }, [id]);

  const handleScrollToSettings = () => {
    const target = document.getElementById('site-settings');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  useEffect(() => {
    if (!deleting) {
      setDeleteCountdown(null);
      return;
    }
    setDeleteCountdown(30);
    const timer = setInterval(() => {
      setDeleteCountdown((prev) => {
        if (prev === null) return prev;
        if (prev <= 1) {
          clearInterval(timer);
          setDeleting(false);
          navigate('/sites');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [deleting, navigate]);

  const handleDeleteSite = async () => {
    if (!id || deleting) return;
    if (!confirm(t('sites.detail.deleteconfirm'))) return;
    setDeleting(true);
    try {
      await api.del(`/sites/${id}`);
    } catch (err) {
      alert((err as Error).message);
    }
  };

  if (!site) {
    return <div className="text-zinc-400">{t('sites.detail.loading')}</div>;
  }
  
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h1 className="text-2xl font-bold text-white flex items-center gap-3">
             {site.name}
             <a href={`https://${site.domain}`} target="_blank" className="text-sm font-normal text-zinc-500 hover:text-indigo-400 flex items-center gap-1">
               <Globe className="w-3 h-3" /> {site.domain}
             </a>
           </h1>
        </div>
        <div className="flex gap-2">
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {deployments[0] && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center">
                <h3 className="font-semibold text-zinc-100">{t('sites.detail.production')}</h3>
                <Badge variant="success">{deployments[0].status}</Badge>
              </div>
              <div className="p-6">
                <div className="mt-4 flex gap-4 text-sm text-zinc-400">
                  <div>
                     <span className="block text-xs text-zinc-500 uppercase">{t('sites.detail.url')}</span>
                     <span className="flex items-center gap-1 text-white">
                       <Globe className="w-3 h-3" />
                       {deployments[0].url || `https://${site.domain}`}
                     </span>
                  </div>
                  <div>
                     <span className="block text-xs text-zinc-500 uppercase">{t('sites.detail.created')}</span>
                     <span className="text-white">{new Date(deployments[0].createdAt).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div>
            <h3 className="text-lg font-medium text-white mb-4">{t('sites.detail.history')}</h3>
            <div className="space-y-3">
               {deployments.map((dep, i) => (
                 <div key={dep.id} className="flex items-center justify-between p-4 rounded-lg bg-zinc-900/30 border border-zinc-800/50 hover:border-zinc-700 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-full ${i === 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-800 text-zinc-500'}`}>
                         {i === 0 ? <CheckCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-zinc-200">Deployment #{dep.id}</div>
                        <div className="text-xs text-zinc-500">{i === 0 ? t('sites.detail.current') : new Date(dep.createdAt).toLocaleString()}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {dep.commitHash && <span className="text-xs font-mono text-zinc-500">{dep.commitHash}</span>}
                      {i !== 0 && <Button size="sm" variant="ghost">{t('sites.detail.rollback')}</Button>}
                    </div>
                 </div>
               ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
           <div id="site-settings">
             <Card title={t('sites.detail.settings')}>
               <div className="space-y-3 text-sm text-zinc-400">
                 <div className="flex justify-between">
                   <span>{t('sites.detail.name')}</span>
                   <span className="text-zinc-200">{site.name}</span>
                 </div>
                 <div className="flex justify-between">
                   <span>{t('sites.detail.domain')}</span>
                   <span className="text-zinc-200">{site.domain}</span>
                 </div>
                 <div className="flex justify-between">
                   <span>{t('sites.detail.framework')}</span>
                   <span className="text-zinc-200">{site.framework}</span>
                 </div>
                 <div className="flex justify-between">
                   <span>{t('sites.detail.lastdeploy')}</span>
                   <span className="text-zinc-200">{new Date(site.lastDeployedAt).toLocaleString()}</span>
                 </div>
                 <Button
                   variant="danger"
                   className="w-full mt-2"
                   onClick={handleDeleteSite}
                   disabled={deleting}
                 >
                   {deleting ? t('sites.detail.deleting') : t('sites.detail.deletesite')}
                 </Button>
                 {deleting && (
                   <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 flex flex-col items-center gap-3">
                     <div className="h-8 w-8 rounded-full border-2 border-red-400 border-t-transparent animate-spin" />
                     <div className="text-red-300 font-medium">{t('sites.detail.deleting')}</div>
                     {deleteCountdown !== null && (
                       <div className="text-xs text-red-200/80">{t('sites.detail.deletecountdown', { seconds: deleteCountdown })}</div>
                     )}
                   </div>
                 )}
               </div>
             </Card>
           </div>
           <Card title={t('sites.detail.domains')}>
             <div className="space-y-3">
               {domains.map((d) => (
                 <div key={d.domain} className="flex items-center justify-between text-sm">
                   <span className="text-zinc-300">{d.domain}</span>
                   <Badge variant={d.type === 'PRIMARY' ? 'success' : 'neutral'}>{d.type}</Badge>
                 </div>
               ))}
               <Button size="sm" variant="outline" className="w-full mt-2">{t('sites.detail.adddomain')}</Button>
             </div>
           </Card>
           
        </div>
      </div>
    </div>
  );
};
