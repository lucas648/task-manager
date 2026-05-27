import { Injectable } from '@angular/core';
import { delay, of } from 'rxjs';
import { CmsPayload } from '../models';

@Injectable({ providedIn: 'root' })
export class CmsService {
  sendToCms(payload: CmsPayload) {
    console.log('Payload enviado ao CMS:', payload);

    return of({
      success: true,
      cmsId: crypto.randomUUID(),
      payload,
    }).pipe(delay(1000));
  }
}