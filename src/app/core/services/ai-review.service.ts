import { Injectable } from '@angular/core';
import { delay, of } from 'rxjs';
import { AiSuggestion, ContentForm } from '../models/content.model';

@Injectable({ providedIn: 'root' })
export class AiReviewService {
  analyze(content: ContentForm) {
    const suggestions: AiSuggestion[] = [];

    if (content.title.length < 10) {
      suggestions.push({
        field: 'title',
        originalValue: content.title,
        suggestedValue: `${content.title} - conteúdo revisado`,
        reason: 'Título pode ser mais descritivo.',
      });
    }

    if (content.description.length < 50) {
      suggestions.push({
        field: 'description',
        originalValue: content.description,
        suggestedValue: `${content.description} Esta descrição foi enriquecida com mais contexto para o CMS.`,
        reason: 'Descrição curta para publicação.',
      });
    }

    return of(suggestions).pipe(delay(1200));
  }
}