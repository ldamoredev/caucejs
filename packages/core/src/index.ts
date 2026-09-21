export type { Handler } from "./handler.js";
export { dispatch } from "./dispatch.js";

export type Cauce = {
  readonly name: "cauce";
};

export function createCauce(): Cauce {
  return { name: "cauce" };
}
