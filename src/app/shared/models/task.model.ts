export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
  id: number;
  title: string;
  description: string;
  completed: boolean;
  priority?: TaskPriority;
  dueDate?: string | null;
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string | null;
}

export interface TaskPayload {
  title: string;
  description: string;
  completed?: boolean;
  priority?: TaskPriority;
  dueDate?: string | null;
}

export type TaskFilter = 'all' | 'active' | 'completed';
