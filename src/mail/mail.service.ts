import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { buildPasswordResetEmail } from './templates/password-reset-email.template';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  private getTransporter(): Transporter | null {
    if (this.transporter) {
      return this.transporter;
    }

    const host = process.env.SMTP_HOST?.trim();
    if (!host) {
      return null;
    }

    const port = Number(process.env.SMTP_PORT ?? 587);
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.trim();

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user ? { user, pass: pass ?? '' } : undefined,
    });

    return this.transporter;
  }

  async sendPasswordResetCode(
    to: string,
    firstName: string,
    code: string,
    expiresInMinutes: number,
  ): Promise<void> {
    const from =
      process.env.SMTP_FROM?.trim() ??
      'ServiceHub <noreply@servicehub.local>';
    const { subject, text, html } = buildPasswordResetEmail(
      firstName,
      code,
      expiresInMinutes,
    );

    const transporter = this.getTransporter();

    if (!transporter) {
      this.logger.warn(
        `SMTP não configurado — código para ${to}: ${code} (válido por ${expiresInMinutes} min)`,
      );
      return;
    }

    try {
      await transporter.sendMail({ from, to, subject, text, html });
    } catch (error) {
      this.logger.error(`Falha ao enviar e-mail para ${to}`, error);
      throw new ServiceUnavailableException(
        'Não foi possível enviar o e-mail. Tente novamente mais tarde.',
      );
    }
  }
}
