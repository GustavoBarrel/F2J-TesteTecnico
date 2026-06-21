import { MAIL_BRAND } from '../mail-brand.constants';

export type PasswordResetEmailContent = {
  subject: string;
  text: string;
  html: string;
};

export function buildPasswordResetEmail(
  firstName: string,
  code: string,
  expiresInMinutes: number,
): PasswordResetEmailContent {
  const { name, tagline, colors } = MAIL_BRAND;
  const subject = `${name} — Código de redefinição de senha`;

  const text = [
    `Olá, ${firstName}.`,
    '',
    `Você solicitou a redefinição de senha no ${name}.`,
    '',
    `Seu código de verificação: ${code}`,
    `Validade: ${expiresInMinutes} minutos.`,
    '',
    'Como usar:',
    '1. Volte à tela de redefinição de senha no sistema.',
    '2. Informe o mesmo usuário ou e-mail usado na solicitação.',
    '3. Digite o código acima e defina sua nova senha.',
    '',
    'Se você não solicitou esta alteração, ignore este e-mail. Sua senha atual permanece a mesma.',
    '',
    `— ${tagline}`,
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:${colors.background};font-family:Arial,Helvetica,sans-serif;color:${colors.text};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:${colors.background};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:${colors.surface};border:1px solid ${colors.border};border-radius:12px;overflow:hidden;">
          <tr>
            <td style="background-color:${colors.primary};padding:24px 32px;text-align:center;">
              <p style="margin:0;font-size:22px;font-weight:700;color:#FFFFFF;letter-spacing:0.3px;">${name}</p>
              <p style="margin:8px 0 0;font-size:13px;color:#DBEAFE;">${tagline}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:16px;line-height:1.5;">Olá, <strong>${escapeHtml(firstName)}</strong>.</p>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:${colors.textMuted};">
                Recebemos uma solicitação para redefinir a senha da sua conta. Use o código abaixo na tela de confirmação do sistema.
              </p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:24px;">
                <tr>
                  <td align="center" style="background-color:${colors.codeBackground};border:2px dashed ${colors.codeBorder};border-radius:10px;padding:20px;">
                    <p style="margin:0 0 8px;font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:${colors.primary};">Código de verificação</p>
                    <p style="margin:0;font-size:36px;font-weight:700;letter-spacing:8px;color:${colors.primaryDark};font-family:'Courier New',Courier,monospace;">${escapeHtml(code)}</p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 24px;font-size:14px;line-height:1.5;color:${colors.textMuted};text-align:center;">
                Este código expira em <strong style="color:${colors.text};">${expiresInMinutes} minutos</strong>.
              </p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:24px;background-color:${colors.background};border-radius:8px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:${colors.text};">Como concluir a redefinição</p>
                    <ol style="margin:0;padding-left:20px;font-size:14px;line-height:1.7;color:${colors.textMuted};">
                      <li>Volte à tela de <strong style="color:${colors.text};">redefinição de senha</strong> no ${name}.</li>
                      <li>Informe o mesmo <strong style="color:${colors.text};">usuário ou e-mail</strong> usado na solicitação.</li>
                      <li>Digite o código acima e defina sua <strong style="color:${colors.text};">nova senha</strong> (com confirmação).</li>
                    </ol>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:${colors.warningBackground};border:1px solid ${colors.warningBorder};border-radius:8px;">
                <tr>
                  <td style="padding:14px 16px;">
                    <p style="margin:0;font-size:13px;line-height:1.5;color:${colors.warningText};">
                      <strong>Não foi você?</strong> Ignore este e-mail. Sua senha atual não será alterada e o código deixará de funcionar após expirar.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:1px solid ${colors.border};background-color:${colors.background};text-align:center;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:${colors.textMuted};">
                Mensagem automática do ${name}. Não responda a este e-mail.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
