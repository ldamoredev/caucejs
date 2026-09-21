export type Handler<TContext, TOutput> = (
  context: TContext,
) => TOutput | Promise<TOutput>;
