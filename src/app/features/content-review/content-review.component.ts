import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormGroup } from '@angular/forms';
import { AiReviewService, CmsService, WorkflowStateService } from '../../core/services';
import { AiSuggestion, CmsPayload, ContentForm } from '../../core/models';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-content-review',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './content-review.component.html',
  styleUrl: './content-review.component.scss',
})
export class ContentReviewComponent implements OnInit {
  state$!: Observable<any>;
  form: FormGroup;

  constructor(
    private fb: FormBuilder,
    private aiReviewService: AiReviewService,
    private cmsService: CmsService,
    private workflowState: WorkflowStateService
  ) {
    this.form = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      description: ['', [Validators.required]],
      category: ['', [Validators.required]],
      tags: [''],
    });
  }

  ngOnInit(): void {
    this.workflowState.reset();
    this.state$ = this.workflowState.state$;
  }

  analyzeWithAi() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.workflowState.setLoadingAi(true);
    this.workflowState.setError(undefined);

    this.aiReviewService.analyze(this.form.getRawValue() as ContentForm).subscribe({
      next: suggestions => {
        this.workflowState.setSuggestions(suggestions);
        this.workflowState.updateStatus('ai_analyzed');
        this.workflowState.setLoadingAi(false);
      },
      error: error => {
        this.workflowState.setError('Erro ao analisar conteúdo com IA');
        this.workflowState.setLoadingAi(false);
      },
    });
  }

  applySuggestion(suggestion: AiSuggestion) {
    this.form.patchValue({
      [suggestion.field]: suggestion.suggestedValue,
    });
  }

  approveHumanReview() {
    const formValue = this.form.getRawValue() as ContentForm;

    const generatedJson: CmsPayload = {
      title: formValue.title,
      description: formValue.description,
      category: formValue.category,
      tags: formValue.tags
        .split(',')
        .map((tag: string) => tag.trim())
        .filter(Boolean),
      approvedAt: new Date().toISOString(),
      status: 'human_approved',
    };

    this.workflowState.setGeneratedJson(generatedJson);
    this.workflowState.updateStatus('human_approved');
  }

  sendToCms() {
    const state = this.workflowState.getState();
    if (!state.generatedJson) return;

    this.workflowState.setSendingCms(true);
    this.workflowState.setError(undefined);

    this.cmsService.sendToCms(state.generatedJson).subscribe({
      next: () => {
        this.workflowState.updateStatus('sent_to_cms');
        this.workflowState.setSendingCms(false);
      },
      error: error => {
        this.workflowState.updateStatus('cms_error');
        this.workflowState.setError('Erro ao enviar para CMS');
        this.workflowState.setSendingCms(false);
      },
    });
  }
}