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
