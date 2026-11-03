import type { PluralForms } from "./core";
import type { SourceMessages } from "./messages/pt-BR";

/** Mesmo formato do idioma de origem; folhas viram `string`, plurais aceitam qualquer categoria. */
export type Translation<T> = {
  [K in keyof T]: T[K] extends string
    ? string
    : T[K] extends { other: string }
      ? PluralForms
      : Translation<T[K]>;
};

export type Messages = Translation<SourceMessages>;
