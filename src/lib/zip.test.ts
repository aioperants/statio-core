import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { crc32, zip } from "./zip";

describe("ZIP files", () => {
  it("checksums like every unzip program", () => {
    expect(crc32(Buffer.from("123456789"))).toBe(0xcbf43926);
  });
  it("holds the files, readable back", () => {
    const out = zip([{ name: "clientes.csv", data: "nombre\r\nMarina Gómez" }, { name: "photos/logo.png", data: new Uint8Array([1, 2, 3]) }]);
    expect(out.readUInt32LE(0)).toBe(0x04034b50);
    expect(out.readUInt16LE(out.length - 22 + 10)).toBe(2);
    const nameLength = out.readUInt16LE(26);
    const packed = out.readUInt32LE(18);
    expect(out.subarray(30, 30 + nameLength).toString()).toBe("clientes.csv");
    expect(inflateRawSync(out.subarray(30 + nameLength, 30 + nameLength + packed)).toString()).toBe("nombre\r\nMarina Gómez");
  });
});
