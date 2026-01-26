// Type declaration for raw SVG imports
declare module "*.svg?raw" {
  const content: string;
  export default content;
}

// Type declaration for openmoji JSON data
declare module "openmoji/data/openmoji.json" {
  const data: Array<{
    emoji: string;
    hexcode: string;
    group: string;
    subgroups: string;
    annotation: string;
    tags: string;
    openmoji_tags: string;
    openmoji_author: string;
    openmoji_date: string;
    skintone: string;
    skintone_combination: string;
    skintone_base_emoji: string;
    skintone_base_hexcode: string;
    unicode: number;
    order: number;
  }>;
  export default data;
}

// Type declaration for webpack require.context
interface RequireContext {
  keys(): string[];
  (id: string): string;
  <T>(id: string): T;
  resolve(id: string): string;
  id: string;
}

declare function require(path: string): unknown;
declare namespace require {
  function context(
    directory: string,
    useSubdirectories?: boolean,
    regExp?: RegExp
  ): RequireContext;
}
