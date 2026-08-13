import type { TaskItem } from '../shared/types.js';
/**
 * Google Tasks + local fallback...
 */
export declare class TasksService {
    isConfigured(): boolean;
    create(input: {
        title: string;
        due?: string;
        priority: TaskItem['priority'];
    }): Promise<TaskItem>;
    list(includeDone?: boolean): Promise<TaskItem[]>;
    private pushToGoogle;
    private getAccessToken;
}
export declare const tasksService: TasksService;
