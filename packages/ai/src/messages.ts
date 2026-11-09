/** Text, written by the user or by the model. */
export type TextBlock = { readonly type: 'text'; readonly text: string }

/** The model asks for a tool to run, with its input as the model wrote it: unchecked. */
export type ToolCallBlock = { readonly type: 'toolCall'; readonly id: string; readonly name: string; readonly input: unknown }

/** What a tool answered, for the call with that id. `isError` tells the model the tool failed. */
export type ToolResultBlock = { readonly type: 'toolResult'; readonly toolCallId: string; readonly content: string; readonly isError: boolean }

/** What the application says: text, and the results of the tools the model asked for. */
export type UserMessage = { readonly role: 'user'; readonly content: readonly (TextBlock | ToolResultBlock)[] }

/** What the model said: text, and the tools it asks for. */
export type AssistantMessage = { readonly role: 'assistant'; readonly content: readonly (TextBlock | ToolCallBlock)[] }

/** One turn of a conversation. The form is Cauce's own, small, and the same for any model. */
export type Message = UserMessage | AssistantMessage

/** A message of the user with one text: `userMessage('When is the opening?')`. */
export function userMessage(text: string): UserMessage {
    return { role: 'user', content: [{ type: 'text', text }] }
}
