import { inject, InjectionToken } from '@angular/core';
import { BoardRecommendationProvider, TaskAnalysisProvider } from '../models/task.model';
import { MockBoardRecommendationProvider } from './mock-board-recommendation.provider';
import { MockTaskAnalysisProvider } from './mock-task-analysis.provider';

export const TASK_ANALYSIS_PROVIDER = new InjectionToken<TaskAnalysisProvider>(
  'TaskAnalysisProvider',
  {
    providedIn: 'root',
    factory: () => inject(MockTaskAnalysisProvider),
  },
);

export const BOARD_RECOMMENDATION_PROVIDER = new InjectionToken<BoardRecommendationProvider>(
  'BoardRecommendationProvider',
  {
    providedIn: 'root',
    factory: () => inject(MockBoardRecommendationProvider),
  },
);
