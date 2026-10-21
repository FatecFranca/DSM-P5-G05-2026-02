import {
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MlClientService } from './ml-client.service';
import { ML_FEATURES, type MlBatchRequest, type MlFeatures } from './ml.types';

describe('MlClientService', () => {
  const request: MlBatchRequest = {
    model_version: 'teste-v1',
    request_id: 'f42c0a29-32c4-4055-9a93-97a61bb30e5d',
    items: [
      {
        ref: '13ce019c-6ad6-49e1-ae49-9f70860b6ec4',
        features: Object.fromEntries(
          ML_FEATURES.map((feature) => [feature, 1]),
        ) as MlFeatures,
      },
    ],
  };
  const settings: Record<string, string | number> = {
    ML_SERVICE_URL: 'http://ml:8000',
    ML_SERVICE_TOKEN: 's'.repeat(40),
    ML_CLIENT_TIMEOUT_MS: 1000,
    ML_PREVIEW_ENABLED: 'true',
  };
  const config = {
    get: jest.fn((key: string) => settings[key]),
  } as unknown as ConfigService;
  const client = new MlClientService(config);

  afterEach(() => jest.restoreAllMocks());

  it('informa quando não há serviço configurado', async () => {
    const missing = new MlClientService({
      get: () => undefined,
    } as unknown as ConfigService);
    await expect(missing.status()).resolves.toEqual({
      configured: false,
      ready: false,
    });
    await expect(missing.predictBatch(request)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('envia apenas o contrato previsto e valida a resposta', async () => {
    const response = {
      model_version: request.model_version,
      request_id: request.request_id,
      results: [
        {
          ref: request.items[0].ref,
          predicted_class: 'Dropout',
          probabilities: { Dropout: 0.7, Enrolled: 0.2, Graduate: 0.1 },
        },
      ],
    };
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify(response), { status: 200 }),
      );
    await expect(client.predictBatch(request)).resolves.toEqual(response);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toEqual(new URL('http://ml:8000/internal/predict-batch'));
    expect(options?.method).toBe('POST');
    expect(options?.body).toBe(JSON.stringify(request));
    expect(options?.headers).toEqual({
      Authorization: `Bearer ${settings.ML_SERVICE_TOKEN}`,
      'Content-Type': 'application/json',
    });
  });

  it('recusa resposta malformada sem repassá-la ao chamador', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          model_version: request.model_version,
          request_id: request.request_id,
          results: [
            {
              ref: request.items[0].ref,
              predicted_class: 'Dropout',
              probabilities: { Dropout: 1.4, Enrolled: -0.4, Graduate: 0 },
            },
          ],
        }),
      ),
    );
    await expect(client.predictBatch(request)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('recusa atributos incompletos antes de chamar a rede', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    const incomplete = {
      ...request,
      items: [{ ...request.items[0], features: { pib: 1 } as MlFeatures }],
    };
    await expect(client.predictBatch(incomplete)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('faz prévia somente quando habilitada e com modelo pronto', async () => {
    const disabled = new MlClientService({
      get: (key: string) =>
        key === 'ML_PREVIEW_ENABLED' ? 'false' : settings[key],
    } as unknown as ConfigService);
    await expect(
      disabled.preview(request.items[0].features),
    ).rejects.toBeInstanceOf(ForbiddenException);

    jest.spyOn(global, 'fetch').mockImplementation((_url, options) => {
      if (!options?.method) {
        return Promise.resolve(
          new Response(JSON.stringify({ model_version: 'teste-v1' }), {
            status: 200,
          }),
        );
      }
      const payload = JSON.parse(options.body as string) as MlBatchRequest;
      return Promise.resolve(
        new Response(
          JSON.stringify({
            model_version: payload.model_version,
            request_id: payload.request_id,
            results: [
              {
                ref: payload.items[0].ref,
                predicted_class: 'Dropout',
                probabilities: { Dropout: 0.7, Enrolled: 0.2, Graduate: 0.1 },
              },
            ],
          }),
          { status: 200 },
        ),
      );
    });
    await expect(client.preview(request.items[0].features)).resolves.toEqual({
      modelVersion: 'teste-v1',
      predictedClass: 'Dropout',
      probabilities: { Dropout: 0.7, Enrolled: 0.2, Graduate: 0.1 },
    });
  });
});
