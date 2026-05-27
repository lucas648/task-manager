import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ContentStatus, AiSuggestion, CmsPayload } from '../models';

export interface WorkflowState {
  status: ContentStatus;
  loadingAi: boolean;
  sendingCms: boolean;
  suggestions: AiSuggestion[];
  generatedJson?: CmsPayload;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class WorkflowStateService {
  private readonly initialState: WorkflowState = {
    status: 'draft',
    loadingAi: false,
    sendingCms: false,
    suggestions: [],
  };

  private readonly stateSubject = new BehaviorSubject<WorkflowState>(this.initialState);
  public readonly state$: Observable<WorkflowState> = this.stateSubject.asObservable();

  getState(): WorkflowState {
    return this.stateSubject.value;
  }

  updateStatus(status: ContentStatus): void {
    this.setState({ ...this.getState(), status });
  }

  setLoadingAi(loading: boolean): void {
    this.setState({ ...this.getState(), loadingAi: loading });
  }

  setSendingCms(sending: boolean): void {
    this.setState({ ...this.getState(), sendingCms: sending });
  }

  setSuggestions(suggestions: AiSuggestion[]): void {
    this.setState({ ...this.getState(), suggestions });
  }

  setGeneratedJson(json: CmsPayload | undefined): void {
    this.setState({ ...this.getState(), generatedJson: json });
  }

  setError(error: string | undefined): void {
    this.setState({ ...this.getState(), error });
  }

  private setState(state: WorkflowState): void {
    this.stateSubject.next(state);
  }

  reset(): void {
    this.setState(this.initialState);
  }
}
