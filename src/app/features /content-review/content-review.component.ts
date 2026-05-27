import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AiReviewService } from '../../core/services/ai-review.service';
import { CmsService } from '../../core/services/cms.service';
import { AiSuggestion, CmsPayload, ContentStatus } from '../../core/models/content.model';

@Component({
  selector: 'app-content-review',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './content-review.component.html',
  styleUrl: './content-review.component.scss',
})
export class ContentReviewComponent {
  status: ContentStatus = 'draft';
  loadingAi = false;
  sendingCms = false;
  suggestions: AiSuggestion[] = [];
  generatedJson?: CmsPayload;

  form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(3)]],
    description: ['', [Validators.required]],
    category: ['', [Validators.required]],
    tags: [''],
  });

  constructor(
    private fb: FormBuilder,
    private aiReviewService: AiReviewService,
    private cmsService: CmsService
  ) {}

  analyzeWithAi() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loadingAi = true;

    this.aiReviewService.analyze(this.form.getRawValue()).subscribe({
      next: suggestions => {
        this.suggestions = suggestions;
        this.status = 'ai_analyzed';
        this.loadingAi = false;
      },
      error: () => {
        this.loadingAi = false;
      },
    });
  }

  applySuggestion(suggestion: AiSuggestion) {
    this.form.patchValue({
      [suggestion.field]: suggestion.suggestedValue,
    });
  }

  approveHumanReview() {
    const formValue = this.form.getRawValue();

    this.generatedJson = {
      title: formValue.title,
      description: formValue.description,
      category: formValue.category,
      tags: formValue.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(Boolean),
      approvedAt: new Date().toISOString(),
      status: 'human_approved',
    };

    this.status = 'human_approved';
  }

  sendToCms() {
    if (!this.generatedJson) return;

    this.sendingCms = true;

    this.cmsService.sendToCms(this.generatedJson).subscribe({
      next: () => {
        this.status = 'sent_to_cms';
        this.sendingCms = false;
      },
      error: () => {
        this.status = 'cms_error';
        this.sendingCms = false;
      },
    });
  }
}