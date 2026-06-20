import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type AiAssistantTab = 'ask' | 'plan' | 'analysis' | 'cleanup' | 'summary';

export interface AiAssistantUiState {
  isOpen: boolean;
  tab: AiAssistantTab;
}

@Injectable({
  providedIn: 'root'
})
export class AiAssistantUiService {
  private readonly stateSubject = new BehaviorSubject<AiAssistantUiState>({
    isOpen: false,
    tab: 'ask'
  });

  readonly state$ = this.stateSubject.asObservable();

  open(tab: AiAssistantTab = 'ask'): void {
    this.stateSubject.next({ isOpen: true, tab });
  }

  close(): void {
    this.stateSubject.next({ ...this.stateSubject.value, isOpen: false });
  }

  selectTab(tab: AiAssistantTab): void {
    this.stateSubject.next({ isOpen: true, tab });
  }
}
