export interface TaskItem {
  id: string;
  title: string;
  milestone: string;
  priority: string;
  shortDescription: string;
  isCompleted: boolean;
  estimatedEffort?: string;
}

export interface ActionPlan {
  planTitle: string;
  estimatedDuration: string;
  difficulty: string;
  milestones: string[];
  tasks: TaskItem[];
  richPlanDetails: string;
  chatResponse: string;
  degraded?: boolean;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}
