import { buildPasswordResetEmail } from './password-reset-email.template';
import { MAIL_BRAND } from '../mail-brand.constants';

describe('buildPasswordResetEmail', () => {
  it('monta assunto, texto e HTML com código e validade', () => {
    const content = buildPasswordResetEmail('Maria', '482913', 5);

    expect(content.subject).toContain(MAIL_BRAND.name);
    expect(content.text).toContain('482913');
    expect(content.text).toContain('5 minutos');
    expect(content.html).toContain('482913');
    expect(content.html).toContain(MAIL_BRAND.colors.primary);
    expect(content.html).toContain('Como concluir a redefinição');
    expect(content.html).toContain('Não foi você?');
  });

  it('escapa caracteres HTML no nome', () => {
    const content = buildPasswordResetEmail('<script>', '123456', 5);

    expect(content.html).not.toContain('<script>');
    expect(content.html).toContain('&lt;script&gt;');
  });
});
