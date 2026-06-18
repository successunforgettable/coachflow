// Type declaration for opentype.js — suppresses TS7016 across all renderers.
declare module "opentype.js" {
  export class Font {
    glyphs: { length: number };
    getAdvanceWidth(text: string, fontSize: number): number;
    getPath(text: string, x: number, y: number, fontSize: number): { toPathData(precision: number): string };
  }
  export function parse(buffer: ArrayBuffer): Font;
}
