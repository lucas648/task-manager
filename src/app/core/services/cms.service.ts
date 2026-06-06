import { inject, Injectable } from '@angular/core';
import { CmsPayload, CmsSendResult } from '../models/task.model';
import { ChaosService } from './chaos.service';

@Injectable({ providedIn: 'root' })
export class CmsService {
  private readonly chaosService = inject(ChaosService);

  send(payload: CmsPayload, sentAt = new Date().toISOString()): CmsSendResult {
    if (this.chaosService.isEnabled('network_loss')) {
      return this.failure(0, 'Perda de conexao simulada durante envio ao CMS.', sentAt);
    }

    if (this.chaosService.isEnabled('cms_unavailable')) {
      return this.failure(503, 'CMS fora do ar no cenario de caos.', sentAt);
    }

    if (this.chaosService.isEnabled('cms_timeout')) {
      return this.failure(408, 'Timeout simulado durante envio ao CMS.', sentAt);
    }

    if (this.chaosService.isEnabled('cms_duplicate_payload')) {
      return this.failure(409, `Payload ${payload.externalId} duplicado no CMS mockado.`, sentAt);
    }

    return {
      success: true,
      statusCode: 202,
      message: `Payload ${payload.externalId} aceito pelo CMS mockado.`,
      sentAt,
    };
  }

  private failure(statusCode: number, message: string, sentAt: string): CmsSendResult {
    return {
      success: false,
      statusCode,
      message,
      sentAt,
    };
  }
}
