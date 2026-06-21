import { appendApiDebugMeta } from './append-api-debug-meta';

describe('appendApiDebugMeta', () => {
  const request = {
    method: 'POST',
    url: '/api/auth/login',
  } as Parameters<typeof appendApiDebugMeta>[1];

  const exception = new Error('Falha de teste');

  afterEach(() => {
    delete process.env.DEBUG_API_RESPONSE;
  });

  it('não adiciona debug quando DEBUG_API_RESPONSE não é true', () => {
    process.env.DEBUG_API_RESPONSE = 'false';

    const body = { statusCode: 400, message: 'Erro' };

    expect(appendApiDebugMeta(body, request, exception)).toEqual(body);
  });

  it('adiciona bloco debug quando DEBUG_API_RESPONSE é true', () => {
    process.env.DEBUG_API_RESPONSE = 'true';

    const result = appendApiDebugMeta(
      { statusCode: 400, message: 'Erro' },
      request,
      exception,
      { prismaCode: 'P2002' },
    );

    expect(result.debug).toMatchObject({
      method: 'POST',
      path: '/api/auth/login',
      exception: 'Error',
      message: 'Falha de teste',
      prismaCode: 'P2002',
    });
    expect(result.debug?.stack).toBeDefined();
  });
});
