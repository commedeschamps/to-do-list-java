export type TaskPriority = 'low' | 'medium' | 'high';

export interface Project {
  id: number;
  name: string;
  color: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Label {
  id: number;
  name: string;
  color: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Subtask {
  id: number;
  title: string;
  completed: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Task {
  id: number;
  title: string;
  description?: string | null;
  completed: boolean;
  priority?: TaskPriority;
  dueDate?: string | null;
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string | null;
  project?: Project | null;
  labels?: Label[];
  color?: string | null;
  subtaskTotal?: number;
  subtaskCompleted?: number;
}

export interface TaskPayload {
  title: string;
  description?: string | null;
  completed?: boolean;
  priority?: TaskPriority;
  dueDate?: string | null;
  projectId?: number | null;
  labelIds?: number[];
  color?: string | null;
}

export interface ProjectPayload {
  name: string;
  color: string;
}

export interface LabelPayload {
  name: string;
  color: string;
}

export interface SubtaskPayload {
  title?: string | null;
  completed?: boolean;
}

export type TaskFilter = 'all' | 'active' | 'completed' | 'overdue' | 'today' | 'noDate';
export type TaskDateFilter = 'all' | 'overdue' | 'today' | 'noDate';
export type TaskSortMode = 'dueDate' | 'priority' | 'newest' | 'oldest' | 'completedFirst' | 'activeFirst';
