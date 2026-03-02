import { Button } from "@/components/ui/button";
import { Camera, RotateCcw, X } from "lucide-react";
import { useState, useRef, useCallback, useEffect } from "react";

export function CameraCapture({ onCapture, onClose, currentPhoto }: { onCapture: (dataUrl: string) => void; onClose: () => void; currentPhoto: string | null }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [error, setError] = useState("");

  const startCamera = useCallback(async () => {
    try {
      setError("");
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 480 }, height: { ideal: 480 } },
        audio: false,
      });
      setStream(mediaStream);
      setCameraActive(true);
    } catch {
      setError("Could not access camera. Please allow camera permissions.");
    }
  }, []);

  useEffect(() => {
    if (cameraActive && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [cameraActive, stream]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
    setCameraActive(false);
  }, [stream]);

  useEffect(() => {
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, [stream]);

  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const size = Math.min(video.videoWidth, video.videoHeight);
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext("2d")!;
    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;
    ctx.drawImage(video, sx, sy, size, size, 0, 0, 400, 400);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    onCapture(dataUrl);
    stopCamera();
  };

  return (
    <div className="space-y-3">
      {currentPhoto && !cameraActive && (
        <div className="flex flex-col items-center gap-2">
          <img src={currentPhoto} alt="Captured" className="w-28 h-28 rounded-full object-cover border-2 border-afrocat-teal" data-testid="img-captured-photo" />
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={startCamera} className="border-afrocat-border text-afrocat-muted hover:bg-afrocat-white-5 text-xs" data-testid="button-retake-photo">
              <RotateCcw className="h-3 w-3 mr-1" /> Retake
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => { onCapture(""); onClose(); }} className="border-afrocat-border text-afrocat-red hover:bg-afrocat-red-soft text-xs" data-testid="button-remove-photo">
              <X className="h-3 w-3 mr-1" /> Remove
            </Button>
          </div>
        </div>
      )}

      {!currentPhoto && !cameraActive && (
        <div className="flex flex-col items-center gap-2">
          <div className="w-28 h-28 rounded-full bg-afrocat-white-5 border-2 border-dashed border-afrocat-border flex items-center justify-center">
            <Camera className="h-8 w-8 text-afrocat-muted" />
          </div>
          <Button type="button" variant="outline" size="sm" onClick={startCamera} className="border-afrocat-teal text-afrocat-teal hover:bg-afrocat-teal-soft text-xs" data-testid="button-open-camera">
            <Camera className="h-3 w-3 mr-1" /> Take Photo
          </Button>
        </div>
      )}

      {cameraActive && (
        <div className="flex flex-col items-center gap-2">
          <div className="relative w-48 h-48 rounded-full overflow-hidden border-2 border-afrocat-teal">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" data-testid="video-camera" />
          </div>
          {error && <p className="text-xs text-afrocat-red">{error}</p>}
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={takePhoto} className="bg-afrocat-teal hover:bg-afrocat-teal-dark text-white text-xs" data-testid="button-capture-photo">
              <Camera className="h-3 w-3 mr-1" /> Capture
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => { stopCamera(); onClose(); }} className="border-afrocat-border text-afrocat-muted text-xs" data-testid="button-cancel-camera">
              Cancel
            </Button>
          </div>
        </div>
      )}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
