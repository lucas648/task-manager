import { FILTER_OPTIONS, STARTER_TASKS, STATUS_OPTIONS, TASK_COLUMNS } from './task.model';

describe('task model constants', () => {
  it('defines status options in the expected workflow order', () => {
    expect(STATUS_OPTIONS).toEqual([
      { value: 'pending', label: 'Pendente' },
      { value: 'in_progress', label: 'Em andamento' },
      { value: 'done', label: 'Concluida' },
    ]);
  });

  it('builds filters from all tasks plus every status', () => {
    expect(FILTER_OPTIONS).toEqual([{ value: 'all', label: 'Todas' }, ...STATUS_OPTIONS]);
  });

  it('defines board columns for every task status', () => {
    expect(TASK_COLUMNS.map((column) => column.status)).toEqual(['pending', 'in_progress', 'done']);
    expect(TASK_COLUMNS.every((column) => column.label && column.caption)).toBe(true);
  });

  it('seeds one starter task for each status', () => {
    expect(STARTER_TASKS.map((task) => task.status)).toEqual(['pending', 'in_progress', 'done']);
    expect(new Set(STARTER_TASKS.map((task) => task.id)).size).toBe(STARTER_TASKS.length);
  });
});
