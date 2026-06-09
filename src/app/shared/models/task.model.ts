export interface Task {
  id: number;
  title: string;
  description: string;
  completed: boolean;
}

export interface TaskPayload {
  title: string;
  description: string;
  completed?: boolean;
}

export type TaskFilter = 'all' | 'active' | 'completed';
