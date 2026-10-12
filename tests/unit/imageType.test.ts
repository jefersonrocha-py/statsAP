import { describe, expect, it } from "vitest";
import { detectImageType } from "@lib/imageType";

const bytes = (...values: number[]) => new Uint8Array(values);
const ascii = (text: string) => Array.from(text, (char) => char.charCodeAt(0));

describe("detectImageType", () => {
  it("reconhece PNG pela assinatura", () => {
    expect(detectImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0))).toEqual({
      mime: "image/png",
      ext: "png",
    });
  });

  it("reconhece JPEG pela assinatura", () => {
    expect(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10))).toEqual({ mime: "image/jpeg", ext: "jpg" });
  });

  it("reconhece WebP (RIFF....WEBP)", () => {
    expect(detectImageType(bytes(...ascii("RIFF"), 1, 2, 3, 4, ...ascii("WEBPVP8 ")))).toEqual({
      mime: "image/webp",
      ext: "webp",
    });
  });

  it("recusa SVG, mesmo que o navegador diga que é imagem", () => {
    const svg = ascii("<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>");
    expect(detectImageType(bytes(...svg))).toBeNull();
  });

  it("recusa outros formatos e arquivos truncados", () => {
    expect(detectImageType(bytes(...ascii("GIF89a"), 0, 0, 0, 0, 0, 0))).toBeNull();
    expect(detectImageType(bytes(...ascii("RIFF"), 1, 2, 3, 4, ...ascii("WAVEfmt ")))).toBeNull();
    expect(detectImageType(bytes(0x89, 0x50))).toBeNull();
    expect(detectImageType(bytes())).toBeNull();
  });
});
