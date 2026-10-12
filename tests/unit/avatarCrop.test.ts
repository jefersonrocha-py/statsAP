import { describe, expect, it } from "vitest";
import { centerCropRect } from "@lib/avatarCrop";

describe("centerCropRect", () => {
  it("recorta o quadrado central de uma imagem deitada", () => {
    expect(centerCropRect(400, 200)).toEqual({ sx: 100, sy: 0, size: 200 });
  });

  it("recorta o quadrado central de uma imagem em pé", () => {
    expect(centerCropRect(300, 500)).toEqual({ sx: 0, sy: 100, size: 300 });
  });

  it("mantém uma imagem quadrada inteira", () => {
    expect(centerCropRect(256, 256)).toEqual({ sx: 0, sy: 0, size: 256 });
  });
});
