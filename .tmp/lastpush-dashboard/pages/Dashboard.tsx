import React, { useEffect, useState } from 'react';
import { Card, Button } from '../components/ui/Common.tsx';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Link } from 'react-router-dom';
import { GitCommit } from 'lucide-react';
import { api } from '../api.ts';
import { DomainSummary, Deployment, SiteSummary } from '../types.ts';
import { useI18n } from '../i18n.tsx';

const buildWeek = () => {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return days.map((name) => ({ name, deploys: 0 }));
};

export const Dashboard: React.FC = () => {
  const { t } = useI18n();
  const [sitesCount, setSitesCount] = useState(0);
  const [domainsCount, setDomainsCount] = useState(0);
  const [balance, setBalance] = useState(0);
  const [activity, setActivity] = useState(buildWeek());
  const [events, setEvents] = useState<{ title: string; desc: string; icon: React.ElementType }[]>([]);

  useEffect(() => {
    api.get<{ items: SiteSummary[] }>('/sites')
      .then((res) => setSitesCount(res.items.length))
      .catch(() => null);
    api.get<{ items: DomainSummary[] }>('/domains')
      .then((res) => setDomainsCount(res.items.length))
      .catch(() => null);
    api.get<{ balance: number }>('/billing/balance')
      .then((res) => setBalance(res.balance))
      .catch(() => null);

    api.get<{ items: SiteSummary[] }>('/sites')
      .then(async (res) => {
        const deployments: Deployment[] = [];
        await Promise.all(
          res.items.map((site) =>
            api.get<{ items: Deployment[] }>(`/sites/${site.id}/deployments`)
              .then((d) => deployments.push(...d.items))
              .catch(() => null)
          )
        );

        const week = buildWeek();
        deployments.forEach((dep) => {
          const date = new Date(dep.createdAt);
          const day = date.getDay();
          const index = (day + 6) % 7;
          week[index].deploys += 1;
        });
        setActivity(week);

        const recent = deployments
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 3)
          .map((dep) => ({
            title: `Deployment ${dep.status}`,
            desc: new Date(dep.createdAt).toLocaleString(),
            icon: GitCommit,
          }));
        setEvents(recent);
      })
      .catch(() => null);
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card title={t('dashboard.sites')}>
          <div className="flex justify-between items-end">
            <div>
              <div className="text-3xl font-bold text-white">{sitesCount}</div>
              <div className="text-sm text-zinc-500 mt-1">{t('dashboard.activesites')}</div>
            </div>
            <Link to="/sites/new"><Button size="sm" variant="outline">{t('dashboard.deploy')}</Button></Link>
          </div>
        </Card>
        <Card title={t('dashboard.domains')}>
          <div className="flex justify-between items-end">
             <div>
              <div className="text-3xl font-bold text-white">{domainsCount}</div>
              <div className="text-sm text-zinc-500 mt-1">{t('dashboard.connecteddomains')}</div>
            </div>
            <Link to="/domains/search"><Button size="sm" variant="outline">{t('dashboard.buy')}</Button></Link>
          </div>
        </Card>
        <Card title={t('dashboard.balance')}>
          <div className="flex justify-between items-end">
             <div>
              <div className="text-3xl font-bold text-white">${balance.toFixed(2)}</div>
              <div className="text-sm text-zinc-500 mt-1">{t('dashboard.walletbalance')}</div>
            </div>
            <Link to="/billing"><Button size="sm" variant="outline">{t('dashboard.addfunds')}</Button></Link>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
           <Card title={t('dashboard.activity')}>
              <div className="h-64 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activity}>
                    <XAxis 
                      dataKey="name" 
                      stroke="#52525b" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false} 
                    />
                    <Tooltip 
                      cursor={{fill: '#27272a'}}
                      contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#fff' }}
                    />
                    <Bar dataKey="deploys" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
           </Card>
        </div>
        
        <div className="lg:col-span-1">
          <Card title={t('dashboard.events')}>
            <div className="space-y-4">
              {events.length === 0 && (
                <div className="text-xs text-zinc-500">{t('dashboard.noevents')}</div>
              )}
              {events.map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg hover:bg-zinc-800/50 transition-colors">
                  <div className="mt-1 p-1.5 rounded-md bg-zinc-800 text-zinc-400">
                    <item.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-zinc-200">{item.title}</div>
                    <div className="text-xs text-zinc-500">{item.desc}</div>
                  </div>
                </div>
              ))}
              <Link to="/sites" className="block text-center text-xs text-zinc-500 hover:text-zinc-300 mt-4">{t('dashboard.viewall')}</Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
