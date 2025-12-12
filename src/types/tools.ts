export type Tool = {
  id: string;
  name: string | null;
  developer: string | null;
  description: string | null;
  category: string | null;
  license: string | null;
  url: string | null;
  stack: string | null;
  oss: string | null;
  stableKey?: string | null;
};
