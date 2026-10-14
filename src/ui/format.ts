import type { Stock } from "../game/types";
export const cost = (stock: Partial<Stock>) =>
  Object.entries(stock)
    .map(([k, v]) => `${v} ${k}`)
    .join(" · ");
