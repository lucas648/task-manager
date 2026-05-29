import { Injectable } from '@angular/core';
import { AuditLog, AuditLogEvent } from '../models/task.model';

@Injectable({ providedIn: 'root' })
export class AuditLogService {
  createLog(
    event: AuditLogEvent,
    taskId: string,
    metadata?: Record<string, unknown>,
    timestamp = new Date().toISOString(),
  ): AuditLog {
    return {
      id: this.createId(),
      event,
      taskId,
      timestamp,
      ...(metadata ? { metadata } : {}),
    };
  }

  private createId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}
