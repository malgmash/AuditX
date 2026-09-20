export function canUseLiveCamera(): boolean {
  return typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
}

export function cameraUnavailableReason(err: unknown): string {
  const name = err instanceof DOMException || err instanceof Error ? err.name : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "The browser blocked the camera. Allow camera access for this site, then try again.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No camera is available on this device.";
  }
  if (name === "NotReadableError") {
    return "The camera is already in use by another program.";
  }
  return "The camera could not be started.";
}

export async function openReceiptCamera(): Promise<MediaStream> {
  const rear: MediaStreamConstraints = {
    audio: false,
    video: { facingMode: { ideal: "environment" } },
  };
  try {
    return await navigator.mediaDevices.getUserMedia(rear);
  } catch {
    return navigator.mediaDevices.getUserMedia({ audio: false, video: true });
  }
}

export function stopMediaStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}

export async function captureVideoFrame(video: HTMLVideoElement): Promise<File> {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (width < 1 || height < 1) {
    throw new Error("Wait for the camera to start, then capture.");
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("The camera frame could not be saved.");
  ctx.drawImage(video, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.92);
  });
  if (!blob) throw new Error("The camera frame could not be saved.");
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return new File([blob], `receipt-${stamp}.jpg`, { type: "image/jpeg" });
}
