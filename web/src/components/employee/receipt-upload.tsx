"use client";

import { Camera, ImageUp, X } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  cameraUnavailableReason,
  canUseLiveCamera,
  captureVideoFrame,
  openReceiptCamera,
  stopMediaStream,
} from "@/lib/employee/camera";
import { isReceiptImage } from "@/lib/employee/receipt-client";

type ReceiptUploadProps = {
  file: File | null;
  previewUrl: string | null;
  extracting: boolean;
  error: string | null;
  onFile: (file: File | null) => void;
};

export function ReceiptUpload({ file, previewUrl, extracting, error, onFile }: ReceiptUploadProps) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraFallbackRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [dragging, setDragging] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraBusy, setCameraBusy] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  function stopCamera() {
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOpen(false);
  }

  useEffect(() => {
    return () => stopMediaStream(streamRef.current);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!cameraOpen || !video || !stream) return;
    video.srcObject = stream;
    void video.play();
  }, [cameraOpen]);

  function takeFile(next: File | null) {
    if (!next) {
      onFile(null);
      return;
    }
    if (!isReceiptImage(next)) {
      onFile(null);
      return;
    }
    onFile(next);
  }

  function onInputChange(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0] ?? null;
    takeFile(next);
    event.target.value = "";
  }

  async function onTakePhoto() {
    setCameraError(null);
    if (!canUseLiveCamera()) {
      cameraFallbackRef.current?.click();
      return;
    }
    setCameraBusy(true);
    try {
      const stream = await openReceiptCamera();
      streamRef.current = stream;
      setCameraOpen(true);
    } catch (err) {
      setCameraError(cameraUnavailableReason(err));
    } finally {
      setCameraBusy(false);
    }
  }

  async function onCapture() {
    const video = videoRef.current;
    if (!video) return;
    setCameraError(null);
    setCameraBusy(true);
    try {
      const next = await captureVideoFrame(video);
      stopCamera();
      onFile(next);
    } catch (err) {
      setCameraError(err instanceof Error ? err.message : "The camera frame could not be saved.");
    } finally {
      setCameraBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={onInputChange}
      />
      <input
        ref={cameraFallbackRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={onInputChange}
      />

      <div
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          takeFile(event.dataTransfer.files[0] ?? null);
        }}
        className={
          dragging
            ? "rounded-card border border-slate bg-slate-tint p-4"
            : "rounded-card border border-line-strong bg-surface p-4"
        }
      >
        {cameraOpen ? (
          <div className="flex flex-col gap-3">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="aspect-video w-full rounded-control bg-ink object-cover"
            />
            <p className="text-xs text-ink-muted">Point the camera at the receipt, then capture.</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button type="button" className="min-h-10" disabled={cameraBusy} onClick={() => void onCapture()}>
                Capture photo
              </Button>
              <Button type="button" variant="secondary" className="min-h-10" onClick={stopCamera}>
                Cancel
              </Button>
            </div>
          </div>
        ) : previewUrl ? (
          <div className="flex flex-col gap-3">
            <img
              src={previewUrl}
              alt={file ? `Preview of ${file.name}` : "Receipt preview"}
              className="mx-auto max-h-32 w-full object-contain"
            />
            <p className="truncate text-xs text-ink-muted">{file?.name ?? "Receipt image"}</p>
            <Button type="button" variant="secondary" className="min-h-10" onClick={() => onFile(null)}>
              <X className="size-4" strokeWidth={1.5} aria-hidden="true" />
              Remove image
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm">Drop a receipt image here, or take a photo.</p>
            <p className="text-xs text-ink-muted">JPEG, PNG, WebP or HEIC. Under 8 MB.</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant="secondary"
                className="min-h-10"
                disabled={cameraBusy}
                onClick={() => void onTakePhoto()}
              >
                <Camera className="size-4" strokeWidth={1.5} aria-hidden="true" />
                {cameraBusy ? "Starting camera" : "Take a photo"}
              </Button>
              <Button type="button" variant="secondary" className="min-h-10" onClick={() => galleryRef.current?.click()}>
                <ImageUp className="size-4" strokeWidth={1.5} aria-hidden="true" />
                Choose image
              </Button>
            </div>
          </div>
        )}
      </div>
      {extracting ? (
        <p className="text-xs text-ink-muted">Reading the receipt. This can take a moment.</p>
      ) : null}
      {cameraError ? (
        <p role="alert" className="text-xs text-error">
          {cameraError}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
