import { Inject, Injectable } from '@nestjs/common';
import type Provider from 'oidc-provider';
import { SUPPORTED_SCOPES, OIDC_PROVIDER } from './oidc.constants.js';
import { ConsentService } from './consent.service.js';

export interface InteractionDetails {
  uid: string;
  /** Which step the provider is waiting for: "login" or "consent". */
  promptName: string;
  clientId: string;
  scopes: string[];
  /** Present when the provider already has an SSO session for this browser. */
  sessionAccountId?: string;
  /** True when the relying party demanded a fresh login (prompt=login or max_age): SSO reuse is not allowed. */
  forceReauth: boolean;
}

const epoch = () => Math.floor(Date.now() / 1000);

/**
 * Bridges the React portal and oidc-provider's interaction model (the "interactive OIDC loop").
 *
 * The provider pauses /authorize and stores an Interaction under a `uid`. The portal authenticates
 * the user, then we write the interaction result here; the browser is sent back to the provider's
 * resume URL, which issues the authorization code.
 */
@Injectable()
export class InteractionService {
  constructor(
    @Inject(OIDC_PROVIDER) private readonly provider: Provider,
    private readonly consent: ConsentService,
  ) {}

  async find(uid: string): Promise<InteractionDetails | null> {
    const interaction = await this.provider.Interaction.find(uid);
    if (!interaction) return null;
    return {
      uid,
      promptName: interaction.prompt.name,
      clientId: String(interaction.params.client_id),
      scopes: String(interaction.params.scope ?? '').split(' ').filter(Boolean),
      sessionAccountId: interaction.session?.accountId,
      forceReauth: String(interaction.params.prompt ?? '').split(' ').includes('login') || interaction.params.max_age !== undefined,
    };
  }

  /** Marks the login step as done. Returns the URL the browser must visit to resume the flow. */
  async completeLogin(uid: string, accountId: string, amr: string[]): Promise<string | null> {
    const interaction = await this.provider.Interaction.find(uid);
    if (!interaction) return null;
    interaction.result = {
      ...interaction.lastSubmission,
      login: { accountId, amr, remember: true, ts: epoch() },
    };
    await interaction.save(interaction.exp - epoch());
    return interaction.returnTo;
  }

  /** Approve or deny the consent prompt (only shown after the user revoked an app). */
  async completeConsent(uid: string, accountId: string, approve: boolean): Promise<string | null> {
    const interaction = await this.provider.Interaction.find(uid);
    if (!interaction) return null;

    if (!approve) {
      interaction.result = { error: 'access_denied', error_description: 'The end-user denied access' };
    } else {
      const clientId = String(interaction.params.client_id);
      const requested = String(interaction.params.scope ?? 'openid')
        .split(' ')
        .filter((scope) => (SUPPORTED_SCOPES as readonly string[]).includes(scope));
      const grant = new this.provider.Grant({ accountId, clientId });
      grant.addOIDCScope(requested.join(' '));
      const grantId = await grant.save();
      await this.consent.markGranted(accountId, clientId);
      interaction.result = { ...interaction.lastSubmission, consent: { grantId } };
    }
    await interaction.save(interaction.exp - epoch());
    return interaction.returnTo;
  }
}
