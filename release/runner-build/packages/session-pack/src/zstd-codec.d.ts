declare module "zstd-codec" {
  type ZstdSimple = {
    compress(content: Uint8Array, compressionLevel?: number): Uint8Array;
    decompress(content: Uint8Array): Uint8Array | null;
  };
  type ZstdRuntime = { Simple: new () => ZstdSimple };
  export const ZstdCodec: { run(callback: (runtime: ZstdRuntime) => void): void };
}
