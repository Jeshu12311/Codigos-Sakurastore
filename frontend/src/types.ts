export type AccountStatus = 'ACTIVE' | 'INACTIVE';
export type MailProvider = 'GOOGLE' | 'MICROSOFT';
export type MailConnectionStatus = 'ACTIVE' | 'REAUTH_REQUIRED' | 'REVOKED' | 'ERROR';

export interface MailboxConnection {
  id: string;
  provider: MailProvider;
  externalEmail: string;
  status: MailConnectionStatus;
  senderAllowlist: string[];
  lastSyncAt?: string | null;
  lastErrorCode?: string | null;
}

export interface Account {
  id: string;
  email: string;
  service: string;
  status: AccountStatus;
  createdAt: string;
  _count?: { sales?: number; temporaryCodes?: number };
  mailboxConnection?: MailboxConnection | null;
}

export interface Sale {
  id: string;
  saleCode: string;
  accountId: string;
  customerReference?: string | null;
  active: boolean;
  createdAt: string;
  expiresAt: string;
  account?: Pick<Account, 'id' | 'email' | 'service'>;
}

export interface TemporaryCode {
  id: string;
  accountId: string;
  code: string;
  createdAt: string;
  expiresAt: string;
  used: boolean;
  invalidatedAt?: string | null;
  createdBy?: string | null;
  source?: 'MANUAL' | 'EMAIL';
  saleId?: string | null;
  sale?: { saleCode: string } | null;
  account?: Pick<Account, 'id' | 'email' | 'service'>;
}

export interface AuditLog {
  id: string;
  action: string;
  ip: string;
  accountId?: string | null;
  saleId?: string | null;
  createdAt: string;
  account?: Pick<Account, 'email'> | null;
  sale?: Pick<Sale, 'saleCode'> | null;
}

export interface DashboardStats {
  activeSales: number;
  activeAccounts: number;
  activeCodes: number;
  codesDeliveredToday: number;
  queriesToday: number;
}

export interface PublicCodeResponse {
  success: boolean;
  status?: 'waiting';
  code?: string;
  expiresAt?: string;
  secondsRemaining?: number;
  message?: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}
