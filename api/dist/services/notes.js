import { v4 as uuid } from 'uuid';
import { stateStore } from '../state/store.js';
export class NotesService {
    save(input) {
        const note = {
            id: uuid(),
            text: input.text,
            tags: input.tags ?? [],
            createdAt: new Date().toISOString(),
        };
        return stateStore.addNote(note);
    }
    saveOrder(input) {
        const order = {
            id: uuid(),
            customer: input.customer,
            quantity: input.quantity,
            unit: input.unit,
            dueDate: input.dueDate,
            raw: input.raw,
            createdAt: new Date().toISOString(),
        };
        // Also mirror as a note for quick recall
        stateStore.addNote({
            id: uuid(),
            text: `ORDER: ${input.customer} — ${input.quantity}${input.unit ? ' ' + input.unit : ''}${input.dueDate ? ` due ${input.dueDate}` : ''}`,
            tags: ['order'],
            createdAt: new Date().toISOString(),
        });
        return stateStore.addOrder(order);
    }
}
export const notesService = new NotesService();
//# sourceMappingURL=notes.js.map