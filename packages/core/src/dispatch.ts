import type { Handler } from "./handler.js";

export async function dispatch<TContext, TOutput>(
  handler: Handler<TContext, TOutput>,
  context: TContext,
): Promise<TOutput> {
  return handler(context);
}
