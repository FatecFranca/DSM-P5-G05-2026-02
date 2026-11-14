import { ArgumentsHost, BadRequestException } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

describe('AllExceptionsFilter', () => {
  const status = jest.fn();
  const json = jest.fn();
  const response = { status, json };
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;
  const filter = new AllExceptionsFilter();

  beforeEach(() => {
    jest.clearAllMocks();
    status.mockReturnValue(response);
  });

  it('mantém status e mensagem de erro HTTP', () => {
    filter.catch(new BadRequestException('Entrada inválida'), host);
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      statusCode: 400,
      message: 'Entrada inválida',
    });
  });

  it('não expõe detalhes internos de exceções inesperadas', () => {
    filter.catch(new Error('segredo interno'), host);
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      statusCode: 500,
      message: 'Erro interno do servidor',
    });
  });
});
