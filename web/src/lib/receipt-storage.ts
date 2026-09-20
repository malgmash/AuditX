import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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
