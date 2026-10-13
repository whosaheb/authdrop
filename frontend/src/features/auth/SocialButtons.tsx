import type { SocialProviderInfo } from '../../api/types';
import { socialStartUrl } from '../../api/auth';
import { ProviderIcon } from './ProviderIcons';

/** Plain links: social sign-in is a full-page navigation to the backend, which redirects to the provider. */
export function SocialButtons({ providers, uid }: { providers: SocialProviderInfo[]; uid?: string | undefined }) {
  if (providers.length === 0) return null;
  return (
    <div className="social">
      <div className="divider" role="separator">
        <span>or</span>
      </div>
      <ul className="social-list" aria-label="Other ways to sign in">
        {providers.map((p) => (
          <li key={p.id}>
            <a className="btn btn-secondary btn-social" href={socialStartUrl(p.id, uid)}>
              <ProviderIcon id={p.id} />
              <span>Continue with {p.name}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
