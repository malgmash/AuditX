import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { memoryReceiptStorage, type ReceiptStorage } from "@/lib/employee/receipt-file";

/**
 * Receipt images live in a private bucket. The browser never gets the keys: the server signs a
 * link that works for a few minutes, so an image can be shown without the bucket being public.
 * Server only. Returns null when storage is not configured or signing fails, and the screen says
 * plainly that the image cannot be shown.
 */
const EXPIRES_SECONDS = 600;

let client: S3Client | null | undefined;

function s3(): S3Client | null {
  if (client !== undefined) return client;
  const { S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY, S3_SECRET_KEY } = process.env;
  client =
    S3_ENDPOINT && S3_ACCESS_KEY && S3_SECRET_KEY
      ? new S3Client({
          endpoint: S3_ENDPOINT,
          region: S3_REGION || "us-east-1",
          credentials: { accessKeyId: S3_ACCESS_KEY, secretAccessKey: S3_SECRET_KEY },
          forcePathStyle: true,
        })
      : null;
  return client;
}

export async function receiptImageUrl(storageKey: string): Promise<string | null> {
  const bucket = process.env.S3_BUCKET;
  const c = s3();
  if (!c || !bucket || !storageKey) return null;
  try {
    return await getSignedUrl(c, new GetObjectCommand({ Bucket: bucket, Key: storageKey }), { expiresIn: EXPIRES_SECONDS });
  } catch {
    return null;
  }
}

function mimeFromKey(key: string): string {
  return key.endsWith(".png") ? "image/png" : key.endsWith(".webp") ? "image/webp" : "image/jpeg";
}

function isMissing(err: unknown): boolean {
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e?.name === "NoSuchKey" || e?.name === "NotFound" || e?.$metadata?.httpStatusCode === 404;
}

/**
 * Receipts in the private bucket. This is what lets an upload survive on a host that keeps no
 * state between requests, and it serves the receipts already loaded with the demo data too.
 */
export function createS3ReceiptStorage(c: S3Client, bucket: string): ReceiptStorage {
  return {
    async put(key, bytes, mimeType) {
      await c.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes, ContentType: mimeType }));
    },
    async get(key) {
      try {
        const out = await c.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        if (!out.Body) return null;
        return { bytes: await out.Body.transformToByteArray(), mimeType: out.ContentType || mimeFromKey(key) };
      } catch (err) {
        if (isMissing(err)) return null;
        throw err;
      }
    },
    async has(key) {
      try {
        await c.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        return true;
      } catch (err) {
        if (isMissing(err)) return false;
        throw err;
      }
    },
  };
}

let selected: ReceiptStorage | undefined;

/**
 * The bucket when the app runs on the database and storage is configured, otherwise memory, so
 * fixtures mode and the tests never touch the network.
 */
export function getReceiptStorage(): ReceiptStorage {
  if (selected) return selected;
  const c = process.env.AUDITX_DATA === "db" ? s3() : null;
  const bucket = process.env.S3_BUCKET;
  selected = c && bucket ? createS3ReceiptStorage(c, bucket) : memoryReceiptStorage;
  return selected;
}
