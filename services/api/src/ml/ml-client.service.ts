import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isUUID } from 'class-validator';
import { randomUUID } from 'node:crypto';
import {
  ML_CLASSES,
  ML_FEATURES,
  type MlBatchRequest,
  type MlBatchResponse,
  type MlFeatures,
  type MlPreviewResponse,
  type MlInputFormat,
} from './ml.types';

@Injectable()
export class MlClientService {
  constructor(private readonly config: ConfigService) {}

  schema() {
    return {
      features: ML_FEATURES,
      classes: ML_CLASSES,
      mode: 'TECHNICAL_PREVIEW' as const,
      previewEnabled: this.config.get<string>('ML_PREVIEW_ENABLED') === 'true',
    };
  }

  async status(): Promise<{
    configured: boolean;
    ready: boolean;
    modelVersion?: string;
    originalInputReady?: boolean;
  }> {
    const baseUrl = this.config.get<string>('ML_SERVICE_URL');
    if (!baseUrl) return { configured: false, ready: false };
    try {
      const response = await fetch(new URL('/ready', baseUrl), {
        signal: AbortSignal.timeout(this.timeoutMs()),
      });
      if (!response.ok) return { configured: true, ready: false };
      const body: unknown = await response.json();
      if (!this.isObject(body) || typeof body.model_version !== 'string') {
        return { configured: true, ready: false };
      }
      return {
        configured: true,
        ready: true,
        modelVersion: body.model_version,
        originalInputReady: body.original_input_ready === true,
      };
    } catch {
      return { configured: true, ready: false };
    }
  }

  async preview(
    features: MlFeatures,
    inputFormat: MlInputFormat = 'preprocessed',
  ): Promise<MlPreviewResponse> {
    if (this.config.get<string>('ML_PREVIEW_ENABLED') !== 'true') {
      throw new ForbiddenException('Prévia de ML desabilitada');
    }
    const status = await this.status();
    if (!status.ready || !status.modelVersion) {
      throw new ServiceUnavailableException('Inferência indisponível');
    }
    if (inputFormat === 'original' && !status.originalInputReady) {
      throw new ServiceUnavailableException(
        'Transformação dos dados originais indisponível para este modelo',
      );
    }
    const ref = randomUUID();
    const response = await this.predictBatch({
      model_version: status.modelVersion,
      input_format: inputFormat,
      request_id: randomUUID(),
      items: [{ ref, features }],
    });
    const result = response.results[0];
    return {
      modelVersion: response.model_version,
      predictedClass: result.predicted_class,
      probabilities: result.probabilities,
    };
  }

  async predictBatch(request: MlBatchRequest): Promise<MlBatchResponse> {
    const baseUrl = this.config.get<string>('ML_SERVICE_URL');
    const token = this.config.get<string>('ML_SERVICE_TOKEN');
    if (!baseUrl || !token || !this.validRequest(request)) {
      throw new ServiceUnavailableException('Inferência indisponível');
    }
    try {
      const response = await fetch(
        new URL('/internal/predict-batch', baseUrl),
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
          signal: AbortSignal.timeout(this.timeoutMs()),
        },
      );
      if (response.status === 422) {
        throw new BadRequestException(
          'Atributos incompatíveis: confira os códigos do dataset, contagens inteiras e escalas das notas (ingresso 0–200; semestres 0–20).',
        );
      }
      if (!response.ok) throw new Error('Serviço de inferência indisponível');
      const body: unknown = await response.json();
      if (!this.validResponse(body, request))
        throw new Error('Resposta de inferência inválida');
      return body;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new ServiceUnavailableException('Inferência indisponível');
    }
  }

  private timeoutMs(): number {
    return this.config.get<number>('ML_CLIENT_TIMEOUT_MS') ?? 3000;
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private validRequest(request: MlBatchRequest): boolean {
    if (
      !request ||
      typeof request.model_version !== 'string' ||
      !request.model_version ||
      (request.input_format !== undefined &&
        !['preprocessed', 'original'].includes(request.input_format)) ||
      !isUUID(request.request_id) ||
      !Array.isArray(request.items) ||
      request.items.length < 1 ||
      request.items.length > 100
    )
      return false;
    const references = new Set<string>();
    for (const item of request.items) {
      if (
        !item ||
        !isUUID(item.ref) ||
        references.has(item.ref) ||
        !this.isObject(item.features)
      )
        return false;
      references.add(item.ref);
      const keys = Object.keys(item.features);
      if (
        keys.length !== ML_FEATURES.length ||
        !ML_FEATURES.every((feature) => Number.isFinite(item.features[feature]))
      )
        return false;
      if (
        !keys.every((key) =>
          ML_FEATURES.includes(key as (typeof ML_FEATURES)[number]),
        )
      ) {
        return false;
      }
    }
    return true;
  }

  private validResponse(
    value: unknown,
    request: MlBatchRequest,
  ): value is MlBatchResponse {
    if (
      !this.isObject(value) ||
      value.model_version !== request.model_version ||
      value.request_id !== request.request_id ||
      !Array.isArray(value.results) ||
      value.results.length !== request.items.length
    )
      return false;
    const expected = new Set(request.items.map((item) => item.ref));
    const seen = new Set<string>();
    for (const result of value.results) {
      if (
        !this.isObject(result) ||
        typeof result.ref !== 'string' ||
        !expected.has(result.ref) ||
        seen.has(result.ref) ||
        !ML_CLASSES.includes(
          result.predicted_class as (typeof ML_CLASSES)[number],
        ) ||
        !this.isObject(result.probabilities)
      )
        return false;
      seen.add(result.ref);
      const probabilities = result.probabilities;
      if (Object.keys(probabilities).length !== ML_CLASSES.length) return false;
      const values: number[] = [];
      for (const label of ML_CLASSES) {
        const probability = probabilities[label];
        if (
          typeof probability !== 'number' ||
          !Number.isFinite(probability) ||
          probability < 0 ||
          probability > 1
        )
          return false;
        values.push(probability);
      }
      if (
        Math.abs(values.reduce((sum, number) => sum + number, 0) - 1) > 0.000001
      ) {
        return false;
      }
    }
    return true;
  }
}
