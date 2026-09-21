import { describe, expect, it } from "vitest";
import { dispatch, type Handler } from "../src/index.js";

type GreetingContext = {
  readonly text: string;
};

type MagicNumberContext = {
  readonly number: number;
};

describe("dispatch", () => {
  it("runs a handler against a typed context and returns its output", async () => {
    const context: GreetingContext = { text: "hola" };

    const handler: Handler<GreetingContext, string> = (ctx) =>
      ctx.text.toUpperCase();

    const output: string = await dispatch(handler, context);

    expect(output).toBe("HOLA");
  });

    it("runs an async handler against a typed context and returns its output", async () => {
    const context: GreetingContext = { text: "hola" };

    const handler: Handler<GreetingContext, string> = async (ctx) =>
      ctx.text.toUpperCase();

    const output: string = await dispatch(handler, context);

    expect(output).toBe("HOLA");
  });

  it("runs a handler against another typed context and returns its output", async () => {
    const context: MagicNumberContext = { number: 42 };

    const handler: Handler<MagicNumberContext, number> = (ctx) =>
      ctx.number * 2;

    const output: number = await dispatch(handler, context);

    expect(output).toBe(84);
  });

});
