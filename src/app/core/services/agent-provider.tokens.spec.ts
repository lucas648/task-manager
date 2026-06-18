import { TestBed } from '@angular/core/testing';
import { BOARD_RECOMMENDATION_PROVIDER, TASK_ANALYSIS_PROVIDER } from './agent-provider.tokens';
import { MockBoardRecommendationProvider } from './mock-board-recommendation.provider';
import { MockTaskAnalysisProvider } from './mock-task-analysis.provider';

describe('agent provider tokens', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('resolves the default task analysis provider', () => {
    TestBed.configureTestingModule({});

    expect(TestBed.inject(TASK_ANALYSIS_PROVIDER)).toBeInstanceOf(MockTaskAnalysisProvider);
  });

  it('resolves the default board recommendation provider', () => {
    TestBed.configureTestingModule({});

    expect(TestBed.inject(BOARD_RECOMMENDATION_PROVIDER)).toBeInstanceOf(
      MockBoardRecommendationProvider,
    );
  });
});
