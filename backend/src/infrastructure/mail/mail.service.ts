import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import { AppConfig } from '../../config/app-config.service.js';
import { maskEmail } from '../../common/helpers/email.helper.js';
import { type RenderedEmail } from './templates/layout.js';
import { type OtpPurpose, renderOtpEmail } from './templates/otp.template.js';
import { renderSecurityNotice } from './templates/security-notice.template.js';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;

  constructor(private readonly config: AppConfig) {
    const { host, port, secure, user, pass } = config.mail;
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
      requireTLS: config.isProduction && !secure, // refuse to send credentials/OTPs in clear text
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
  }

  async sendOtp(to: string, code: string, purpose: OtpPurpose): Promise<void> {
    await this.deliver(to, renderOtpEmail({ code, purpose, ttlMinutes: Math.round(this.config.otp.ttlSeconds / 60) }));
  }

  async sendSecurityNotice(to: string, subject: string, heading: string, message: string): Promise<void> {
    await this.deliver(to, renderSecurityNotice({ subject, heading, message }));
  }

  /** Security notices are best effort: they must never fail the user-facing action. */
  async sendSecurityNoticeSafe(to: string, subject: string, heading: string, message: string): Promise<void> {
    try {
      await this.sendSecurityNotice(to, subject, heading, message);
    } catch {
      /* already logged in deliver() */
    }
  }

  private async deliver(to: string, email: RenderedEmail): Promise<void> {
    try {
      await this.transporter.sendMail({ from: this.config.mail.from, to, subject: email.subject, html: email.html, text: email.text });
    } catch (error) {
      this.logger.error({ msg: 'Email delivery failed', to: maskEmail(to), err: (error as Error).message });
      throw new ServiceUnavailableException('We could not send the email right now. Please try again shortly.');
    }
  }
}
