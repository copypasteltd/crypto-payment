import { constants as fsConstants, createReadStream, createWriteStream } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getApiRuntimeConfig } from "../../app/runtime.js";

type StoredObjectInfo = {
  objectKey: string;
  sizeBytes: number;
  sha256: string;
};

type PutObjectBufferInput = {
  content: Buffer;
  contentType?: string | null;
};

type PutObjectPathInput = {
  absolutePath: string;
  contentType?: string | null;
};

type CreateDownloadUrlInput = {
  objectKey: string;
  fileName: string;
  contentType?: string | null;
  expiresInSeconds: number;
};

export interface ObjectStore {
  putBuffer(objectKey: string, input: PutObjectBufferInput): Promise<StoredObjectInfo>;
  putBufferImmutable(objectKey: string, input: PutObjectBufferInput): Promise<StoredObjectInfo>;
  putPath(objectKey: string, input: PutObjectPathInput): Promise<StoredObjectInfo>;
  createReadStream(objectKey: string): Promise<NodeJS.ReadableStream>;
  copyObjectToPath(objectKey: string, absolutePath: string): Promise<void>;
  copyObject(sourceObjectKey: string, targetObjectKey: string): Promise<void>;
  deleteObject(objectKey: string): Promise<void>;
  createDownloadUrl?(input: CreateDownloadUrlInput): Promise<string | null>;
  checkReadiness(): Promise<{
    driver: "filesystem" | "s3";
    ready: boolean;
    detail: string | null;
  }>;
}

export class ObjectStoreImmutableConflictError extends Error {
  readonly objectKey: string;

  constructor(objectKey: string) {
    super(`Immutable object already exists with different content: ${objectKey}`);
    this.name = "ObjectStoreImmutableConflictError";
    this.objectKey = objectKey;
  }
}

function buildSha256(content: Buffer) {
  return createHash("sha256").update(content).digest("hex");
}

async function buildFileSha256(absolutePath: string) {
  const hash = createHash("sha256");
  const stream = createReadStream(absolutePath);

  await new Promise<void>((resolve, reject) => {
    stream.on("data", (chunk) => {
      hash.update(chunk as Buffer);
    });
    stream.on("error", reject);
    stream.on("end", () => resolve());
  });

  return hash.digest("hex");
}

function buildContentDisposition(fileName: string) {
  const fallback = fileName.replace(/[^\x20-\x7e]+/g, "_").replace(/["\\]/g, "_").trim() || "download.bin";
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

function encodeCopySource(bucket: string, objectKey: string) {
  return `${bucket}/${objectKey.split("/").map((segment) => encodeURIComponent(segment)).join("/")}`;
}

function toNodeReadableStream(body: unknown): NodeJS.ReadableStream {
  if (!body) {
    throw new Error("Object store returned an empty body");
  }

  if (body instanceof Readable) {
    return body;
  }

  if (typeof body === "object" && body !== null && "pipe" in body && typeof body.pipe === "function") {
    return body as NodeJS.ReadableStream;
  }

  if (body instanceof Uint8Array) {
    return Readable.from(body);
  }

  throw new Error("Unsupported object store response body");
}

class FilesystemObjectStore implements ObjectStore {
  #root: string;

  constructor(root = getApiRuntimeConfig().objectStorageRoot) {
    this.#root = root;
  }

  #resolveObjectPath(objectKey: string) {
    return path.join(this.#root, objectKey.replace(/\//g, path.sep));
  }

  async putBuffer(objectKey: string, input: PutObjectBufferInput): Promise<StoredObjectInfo> {
    const absolutePath = this.#resolveObjectPath(objectKey);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, input.content);

    return {
      objectKey,
      sizeBytes: input.content.byteLength,
      sha256: buildSha256(input.content),
    };
  }

  async putBufferImmutable(objectKey: string, input: PutObjectBufferInput): Promise<StoredObjectInfo> {
    const absolutePath = this.#resolveObjectPath(objectKey);
    const expected = {
      objectKey,
      sizeBytes: input.content.byteLength,
      sha256: buildSha256(input.content),
    };
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    const temporaryPath = `${absolutePath}.${process.pid}.${randomUUID()}.tmp`;

    try {
      await fs.writeFile(temporaryPath, input.content, { flag: "wx" });
      try {
        await fs.link(temporaryPath, absolutePath);
        return expected;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      }
    } finally {
      await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
    }

    const stats = await fs.stat(absolutePath);
    const existingSha256 = stats.size === expected.sizeBytes
      ? await buildFileSha256(absolutePath)
      : null;
    if (stats.size !== expected.sizeBytes || existingSha256 !== expected.sha256) {
      throw new ObjectStoreImmutableConflictError(objectKey);
    }
    return expected;
  }

  async putPath(objectKey: string, input: PutObjectPathInput): Promise<StoredObjectInfo> {
    const absolutePath = this.#resolveObjectPath(objectKey);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.copyFile(input.absolutePath, absolutePath);
    const stats = await fs.stat(input.absolutePath);

    return {
      objectKey,
      sizeBytes: stats.size,
      sha256: await buildFileSha256(input.absolutePath),
    };
  }

  async createReadStream(objectKey: string) {
    return createReadStream(this.#resolveObjectPath(objectKey));
  }

  async copyObjectToPath(objectKey: string, absolutePath: string) {
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.copyFile(this.#resolveObjectPath(objectKey), absolutePath);
  }

  async copyObject(sourceObjectKey: string, targetObjectKey: string) {
    if (sourceObjectKey === targetObjectKey) {
      return;
    }

    const sourcePath = this.#resolveObjectPath(sourceObjectKey);
    const targetPath = this.#resolveObjectPath(targetObjectKey);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.copyFile(sourcePath, targetPath);
  }

  async deleteObject(objectKey: string) {
    await fs.rm(this.#resolveObjectPath(objectKey), {
      force: true,
    });
  }

  async createDownloadUrl() {
    return null;
  }

  async checkReadiness() {
    try {
      await fs.mkdir(this.#root, { recursive: true });
      await fs.access(this.#root, fsConstants.R_OK | fsConstants.W_OK);
      return {
        driver: "filesystem" as const,
        ready: true,
        detail: null,
      };
    } catch (error) {
      return {
        driver: "filesystem" as const,
        ready: false,
        detail: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

class S3ObjectStore implements ObjectStore {
  #client: S3Client;
  #bucket: string;
  #signedUrlTtlSeconds: number;

  constructor(config = getApiRuntimeConfig()) {
    const credentials =
      config.objectStorageAccessKeyId && config.objectStorageSecretAccessKey
        ? {
            accessKeyId: config.objectStorageAccessKeyId,
            secretAccessKey: config.objectStorageSecretAccessKey,
            sessionToken: config.objectStorageSessionToken,
          }
        : undefined;

    this.#client = new S3Client({
      region: config.objectStorageRegion,
      endpoint: config.objectStorageEndpoint,
      forcePathStyle: config.objectStorageForcePathStyle,
      credentials,
    });
    this.#bucket = config.objectStorageBucket ?? "";
    this.#signedUrlTtlSeconds = config.objectStorageSignedUrlTtlSeconds;
  }

  async putBuffer(objectKey: string, input: PutObjectBufferInput): Promise<StoredObjectInfo> {
    await this.#client.send(
      new PutObjectCommand({
        Bucket: this.#bucket,
        Key: objectKey,
        Body: input.content,
        ContentLength: input.content.byteLength,
        ContentType: input.contentType ?? undefined,
      })
    );

    return {
      objectKey,
      sizeBytes: input.content.byteLength,
      sha256: buildSha256(input.content),
    };
  }

  async putBufferImmutable(objectKey: string, input: PutObjectBufferInput): Promise<StoredObjectInfo> {
    const expected = {
      objectKey,
      sizeBytes: input.content.byteLength,
      sha256: buildSha256(input.content),
    };
    try {
      await this.#client.send(
        new PutObjectCommand({
          Bucket: this.#bucket,
          Key: objectKey,
          Body: input.content,
          ContentLength: input.content.byteLength,
          ContentType: input.contentType ?? undefined,
          IfNoneMatch: "*",
          Metadata: { sha256: expected.sha256 },
        })
      );
      return expected;
    } catch (error) {
      const statusCode = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      const errorName = (error as { name?: string }).name;
      if (statusCode !== 412 && errorName !== "PreconditionFailed") throw error;
    }

    const head = await this.#client.send(new HeadObjectCommand({
      Bucket: this.#bucket,
      Key: objectKey,
    }));
    let existingSha256 = head.Metadata?.sha256 ?? null;
    if (!existingSha256 && head.ContentLength === expected.sizeBytes) {
      const hash = createHash("sha256");
      const stream = await this.createReadStream(objectKey);
      for await (const chunk of stream as AsyncIterable<Buffer | Uint8Array | string>) {
        hash.update(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
      }
      existingSha256 = hash.digest("hex");
    }
    if (head.ContentLength !== expected.sizeBytes || existingSha256 !== expected.sha256) {
      throw new ObjectStoreImmutableConflictError(objectKey);
    }
    return expected;
  }

  async putPath(objectKey: string, input: PutObjectPathInput): Promise<StoredObjectInfo> {
    const stats = await fs.stat(input.absolutePath);
    const sha256 = await buildFileSha256(input.absolutePath);

    await this.#client.send(
      new PutObjectCommand({
        Bucket: this.#bucket,
        Key: objectKey,
        Body: createReadStream(input.absolutePath),
        ContentLength: stats.size,
        ContentType: input.contentType ?? undefined,
      })
    );

    return {
      objectKey,
      sizeBytes: stats.size,
      sha256,
    };
  }

  async createReadStream(objectKey: string) {
    const response = await this.#client.send(
      new GetObjectCommand({
        Bucket: this.#bucket,
        Key: objectKey,
      })
    );

    return toNodeReadableStream(response.Body);
  }

  async copyObjectToPath(objectKey: string, absolutePath: string) {
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    const source = await this.createReadStream(objectKey);
    const target = createWriteStream(absolutePath);
    await pipeline(source, target);
  }

  async copyObject(sourceObjectKey: string, targetObjectKey: string) {
    if (sourceObjectKey === targetObjectKey) {
      return;
    }

    await this.#client.send(
      new CopyObjectCommand({
        Bucket: this.#bucket,
        CopySource: encodeCopySource(this.#bucket, sourceObjectKey),
        Key: targetObjectKey,
      })
    );
  }

  async deleteObject(objectKey: string) {
    await this.#client.send(
      new DeleteObjectCommand({
        Bucket: this.#bucket,
        Key: objectKey,
      })
    );
  }

  async createDownloadUrl(input: CreateDownloadUrlInput) {
    const expiresIn = Math.max(
      1,
      Math.min(this.#signedUrlTtlSeconds, input.expiresInSeconds, 60 * 60 * 24 * 7)
    );

    return await getSignedUrl(
      this.#client,
      new GetObjectCommand({
        Bucket: this.#bucket,
        Key: input.objectKey,
        ResponseContentDisposition: buildContentDisposition(input.fileName),
        ResponseContentType: input.contentType ?? undefined,
      }),
      {
        expiresIn,
      }
    );
  }

  async checkReadiness() {
    try {
      await this.#client.send(
        new HeadBucketCommand({
          Bucket: this.#bucket,
        })
      );
      return {
        driver: "s3" as const,
        ready: true,
        detail: null,
      };
    } catch (error) {
      return {
        driver: "s3" as const,
        ready: false,
        detail: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

function buildObjectStore() {
  const config = getApiRuntimeConfig();
  return config.objectStorageDriver === "s3"
    ? new S3ObjectStore(config)
    : new FilesystemObjectStore(config.objectStorageRoot);
}

export const objectStore = buildObjectStore();
