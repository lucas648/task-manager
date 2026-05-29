import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TaskService } from '../../core/services/task.service';
import { TaskCreateComponent } from './task-create.component';

type TaskCreateTestApi = {
  taskForm: {
    setValue(value: {
      title: string;
      description: string;
      status: 'pending' | 'in_progress' | 'done';
    }): void;
    controls: {
      title: {
        invalid: boolean;
      };
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

  it('renders the creation form, status options, and list link', () => {
    const fixture = TestBed.createComponent(TaskCreateComponent);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('h1')?.textContent).toContain('Inserir nova task');
    expect(element.querySelector('a')?.getAttribute('href')).toBe('/tasks');
    expect(
      [...element.querySelectorAll('option')].map((option) => option.textContent?.trim()),
    ).toEqual(['Pendente', 'Em andamento', 'Concluida']);
  });

  it('marks the form when the title is empty', () => {
    const fixture = TestBed.createComponent(TaskCreateComponent);
    const component = fixture.componentInstance as unknown as TaskCreateTestApi;
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    component.addTask();
    fixture.detectChanges();

    expect(taskService.addTask).not.toHaveBeenCalled();
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(component.taskForm.controls.title.invalid).toBe(true);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.form-error')?.textContent,
    ).toContain('Informe um titulo');
  });

  it('rejects titles that only become short after trimming', () => {
    const fixture = TestBed.createComponent(TaskCreateComponent);
    const component = fixture.componentInstance as unknown as TaskCreateTestApi;

    component.taskForm.setValue({
      title: '   ',
      description: 'Espacos nao contam como titulo',
      status: 'pending',
    });
    component.addTask();

    expect(taskService.addTask).not.toHaveBeenCalled();
    expect(component.taskForm.controls.title.invalid).toBe(true);
  });

  it('adds a valid task and navigates to the full task list', () => {
    const fixture = TestBed.createComponent(TaskCreateComponent);
    const component = fixture.componentInstance as unknown as TaskCreateTestApi;
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    component.taskForm.setValue({
      title: 'Nova task',
      description: 'Detalhes da task',
      status: 'in_progress',
    });
    component.addTask();

    expect(taskService.addTask).toHaveBeenCalledWith({
      title: 'Nova task',
      description: 'Detalhes da task',
      status: 'in_progress',
    });
    expect(navigateSpy).toHaveBeenCalledWith('/tasks');
  });
});
