export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
  id: number;
  title: string;
  description: string;
  completed: boolean;
  priority?: TaskPriority;
}

export interface TaskPayload {
  title: string;
  description: string;
  completed?: boolean;
  priority?: TaskPriority;
}

export type TaskFilter = 'all' | 'active' | 'completed';
