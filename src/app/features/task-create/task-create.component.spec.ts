import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TaskPriority } from '../../core/models/task.model';
import { TaskService } from '../../core/services/task.service';
import { TaskCreateComponent } from './task-create.component';

type TaskCreateTestApi = {
  taskForm: {
    setValue(value: {
      title: string;
      description: string;
      priority: TaskPriority;
      category: string;
      tags: string;
      assignee: string;
      dueDate: string;
      acceptanceCriteria: string;
    }): void;
    controls: {
      title: { invalid: boolean };
      description: { invalid: boolean };
      category: { invalid: boolean };
    };
  };
  addTask(): void;
};

describe('TaskCreateComponent', () => {
  const taskService = {
    addTask: vi.fn(),
  };

  beforeEach(async () => {
    taskService.addTask.mockClear();

    await TestBed.configureTestingModule({
      imports: [TaskCreateComponent],
      providers: [
        provideRouter([]),
        {
          provide: TaskService,
          useValue: taskService,
        },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('renders the creation form, priority options, and list link', () => {
    const fixture = TestBed.createComponent(TaskCreateComponent);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('h1')?.textContent).toContain('Inserir nova task');
    expect(element.querySelector('a')?.getAttribute('href')).toBe('/tasks');
    expect(
      [...element.querySelectorAll('option')].map((option) => option.textContent?.trim()),
    ).toEqual(['Baixa', 'Media', 'Alta', 'Urgente']);
    expect(element.textContent).not.toContain('Status inicial');
  });

  it('marks required text fields when they are empty or whitespace only', () => {
    const fixture = TestBed.createComponent(TaskCreateComponent);
    const component = fixture.componentInstance as unknown as TaskCreateTestApi;
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    component.taskForm.setValue({
      title: '  ',
      description: ' ',
      priority: TaskPriority.Medium,
      category: ' ',
      tags: '',
      assignee: '',
      dueDate: '',
      acceptanceCriteria: '',
    });
    component.addTask();
    fixture.detectChanges();

    expect(taskService.addTask).not.toHaveBeenCalled();
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(component.taskForm.controls.title.invalid).toBe(true);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.form-error')?.textContent,
    ).toContain('Informe um titulo');
  });

  it('shows description and category validation messages after title is valid', () => {
    const fixture = TestBed.createComponent(TaskCreateComponent);
    const component = fixture.componentInstance as unknown as TaskCreateTestApi;

    component.taskForm.setValue({
      title: 'Titulo valido',
      description: '',
      priority: TaskPriority.Medium,
      category: '',
      tags: '',
      assignee: '',
      dueDate: '',
      acceptanceCriteria: '',
    });
    component.addTask();
    fixture.detectChanges();
    expect(component.taskForm.controls.description.invalid).toBe(true);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.form-error')?.textContent,
    ).toContain('descricao');

    component.taskForm.setValue({
      title: 'Titulo valido',
      description: 'Descricao valida',
      priority: TaskPriority.Medium,
      category: '',
      tags: '',
      assignee: '',
      dueDate: '',
      acceptanceCriteria: '',
    });
    component.addTask();
    fixture.detectChanges();
    expect(component.taskForm.controls.category.invalid).toBe(true);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.form-error')?.textContent,
    ).toContain('categoria');
  });

  it('keeps valid description and category controls untouched when only title is invalid', () => {
    const fixture = TestBed.createComponent(TaskCreateComponent);
    const component = fixture.componentInstance as unknown as TaskCreateTestApi;

    component.taskForm.setValue({
      title: 'ab',
      description: 'Descricao valida',
      priority: TaskPriority.Medium,
      category: 'Produto',
      tags: '',
      assignee: '',
      dueDate: '',
      acceptanceCriteria: '',
    });
    component.addTask();

    expect(taskService.addTask).not.toHaveBeenCalled();
    expect(component.taskForm.controls.title.invalid).toBe(true);
    expect(component.taskForm.controls.description.invalid).toBe(false);
    expect(component.taskForm.controls.category.invalid).toBe(false);
  });

  it('adds a valid draft task and navigates to the full task list', () => {
    const fixture = TestBed.createComponent(TaskCreateComponent);
    const component = fixture.componentInstance as unknown as TaskCreateTestApi;
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    component.taskForm.setValue({
      title: 'Nova task',
      description: 'Detalhes da task',
      priority: TaskPriority.High,
      category: 'Produto',
      tags: 'bug, auth\nux',
      assignee: 'Lucas',
      dueDate: '2026-06-01',
      acceptanceCriteria: 'Criterio um\nCriterio dois',
    });
    component.addTask();

    expect(taskService.addTask).toHaveBeenCalledWith({
      title: 'Nova task',
      description: 'Detalhes da task',
      priority: TaskPriority.High,
      category: 'Produto',
      tags: ['bug', 'auth', 'ux'],
      assignee: 'Lucas',
      dueDate: '2026-06-01',
      acceptanceCriteria: ['Criterio um', 'Criterio dois'],
    });
    expect(navigateSpy).toHaveBeenCalledWith('/tasks');
  });
});
