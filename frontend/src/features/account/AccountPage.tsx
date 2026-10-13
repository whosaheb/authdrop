import { useSearchParams } from 'react-router-dom';
import { TabPanel, Tabs, type TabItem } from '../../components/ui/Tabs';
import { Avatar } from '../../components/layout/PortalLayout';
import { Badge } from '../../components/ui/Badge';
import { useUser } from '../../hooks/useSession';
import { usePageTitle } from '../../hooks/usePageTitle';
import { ProfileTab } from './ProfileTab';
import { SecurityTab } from './SecurityTab';
import { SessionsTab } from './SessionsTab';

// The backend exposes the audit trail to admins only (GET /api/admin/audit), so there is no user-facing Activity tab.
const TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'security', label: 'Security' },
  { id: 'sessions', label: 'Sessions and apps' },
] as const satisfies readonly TabItem<string>[];
type TabId = (typeof TABS)[number]['id'];

function isTab(v: string | null): v is TabId {
  return TABS.some((t) => t.id === v);
}

export function AccountPage() {
  usePageTitle('Account settings');
  const user = useUser();
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab');
  const tab: TabId = isTab(raw) ? raw : 'profile';

  return (
    <div className="page">
      <header className="page-head">
        <Avatar url={user.avatarUrl} first={user.firstName} last={user.lastName} size={56} />
        <div>
          <h1>
            {user.firstName} {user.lastName}
          </h1>
          <p className="muted">
            <span className="break">{user.email}</span> {user.role !== 'USER' ? <Badge tone="accent">{user.role === 'ADMIN' ? 'Admin' : 'Developer'}</Badge> : null}
          </p>
        </div>
      </header>
      <Tabs items={TABS} value={tab} onChange={(id) => setParams({ tab: id }, { replace: true })} label="Account settings" idPrefix="acct" />
      <TabPanel idPrefix="acct" id={tab}>
        {tab === 'profile' ? <ProfileTab /> : tab === 'security' ? <SecurityTab /> : <SessionsTab />}
      </TabPanel>
    </div>
  );
}
