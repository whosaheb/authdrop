import { Module } from '@nestjs/common';
import { FacebookProvider } from './providers/facebook.provider.js';
import { GitHubProvider } from './providers/github.provider.js';
import { GoogleProvider } from './providers/google.provider.js';
import { LinkedInProvider } from './providers/linkedin.provider.js';
import { SocialService } from './social.service.js';

@Module({
  providers: [GoogleProvider, GitHubProvider, FacebookProvider, LinkedInProvider, SocialService],
  exports: [SocialService],
})
export class SocialModule {}
