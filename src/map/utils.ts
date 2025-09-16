type Entries<T> = {
  [K in keyof T]: [K, T[K]];
}[keyof T][];

export const getEntries = Object.entries as <T>(obj: T) => Entries<T>;
