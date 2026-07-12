export type User = {
  id: string;
  email?: string;
  walletAddress?: string;
  handle?: string;
  avatar?: string;
  balance: number;
};

export enum DomainStatus {
  AVAILABLE = 'AVAILABLE',
  REGISTERED = 'REGISTERED',
  PREMIUM = 'PREMIUM',
  UNAVAILABLE = 'UNAVAILABLE',
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  PENDING = 'PENDING',
}

export type DomainSearchResult = {
  name: string;
  status: DomainStatus;
  price: number;
  renewalPrice: number;
};

export type DNSRecord = {
  id: string;
  type: 'A' | 'AAAA' | 'CNAME' | 'TXT' | 'MX' | 'SRV' | 'CAA' | 'URI';
  name: string;
  content: string;
  ttl: number;
  proxied: boolean;
};

export type Domain = {
  name: string;
  registrarStatus: 'ClientHold' | 'Ok' | 'Pending';
  autoRenew: boolean;
  expiresAt: string;
  dnsMode: 'AUTO' | 'MANUAL';
  sslStatus: 'ISSUING' | 'ACTIVE' | 'EXPIRED';
  records: DNSRecord[];
  recordLimit?: number;
  recordUsage?: number;
};

export type DomainSummary = Omit<Domain, 'records'>;

export enum DeploymentStatus {
  QUEUED = 'QUEUED',
  BUILDING = 'BUILDING',
  READY = 'READY',
  ERROR = 'ERROR',
  CANCELED = 'CANCELED'
}

export type Deployment = {
  id: string;
  siteId: string;
  commitHash?: string;
  branch?: string;
  status: DeploymentStatus;
  createdAt: string;
  url?: string;
  logs: string[];
};

export type Site = {
  id: string;
  name: string;
  domain: string;
  framework: 'vite' | 'next' | 'static' | 'create-react-app';
  status: 'LIVE' | 'OFFLINE' | 'MAINTENANCE';
  lastDeployedAt: string;
  deployments: Deployment[];
};

export type SiteSummary = Omit<Site, 'deployments'>;

export type Order = {
  id: string;
  type: 'REGISTER' | 'RENEW' | 'TRANSFER';
  domain: string;
  amount: number;
  status: 'CREATED' | 'PENDING_PAYMENT' | 'PAID' | 'PROVISIONING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
  fulfillmentStatus?: 'PURCHASING' | 'PURCHASED' | 'CLOUDFLARE_PENDING' | 'ONLINE' | 'FAILED';
};
