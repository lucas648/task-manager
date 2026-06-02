import { Injectable } from '@angular/core';
import { CmsPayload, CmsSendResult } from '../models/task.model';

@Injectable({ providedIn: 'root' })
export class CmsService {
  send(payload: CmsPayload, sentAt = new Date().toISOString()): CmsSendResult {
    return {
      success: true,
      statusCode: 202,
      message: `Payload ${payload.externalId} aceito pelo CMS mockado.`,
      sentAt,
    };
  }
}
