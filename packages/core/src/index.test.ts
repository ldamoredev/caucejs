import { describe, expect, it } from "vitest";
import { createCauce } from "./index.js";

describe("createCauce", () => {
  it("returns the framework name with a typed result", () => {
    const result: { readonly name: "cauce" } = createCauce();
    expect(result.name).toBe("cauce");
  });
});
