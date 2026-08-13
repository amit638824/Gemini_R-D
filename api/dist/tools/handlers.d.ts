export type ToolEvent = {
    name: string;
    args: Record<string, unknown>;
    result: unknown;
};
export declare function handleToolCall(name: string, args: Record<string, unknown>): Promise<{
    result: unknown;
    event: ToolEvent;
}>;
export declare function toolResponsePayload(id: string, name: string, result: unknown): {
    id: string;
    name: string;
    response: {
        result: unknown;
    };
};
