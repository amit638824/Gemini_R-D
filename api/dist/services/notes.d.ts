import type { NoteItem, OrderItem } from '../shared/types.js';
export declare class NotesService {
    save(input: {
        text: string;
        tags?: string[];
    }): NoteItem;
    saveOrder(input: {
        customer: string;
        quantity: number;
        unit?: string;
        dueDate?: string;
        raw: string;
    }): OrderItem;
}
export declare const notesService: NotesService;
