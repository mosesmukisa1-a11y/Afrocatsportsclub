import { Button } from "@/components/ui/button";
import { Camera, RotateCcw, X, Upload, SwitchCamera } from "lucide-react";
import { useState, useRef, useCallback, useEffect } from "react";

type FacingMode = "user" | "environment";

export function CameraCapture({ onCapture, onClose, currentPhoto }: { onCapture: (dataUrl: string) => void; onClose: () => void; currentPhoto: string | null }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<FacingMode>("user");
  const [error, setError] = useState("");

  const startCamera = useCallback(async (facing: FacingMode = "user") => {
    try {
      setError("");
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 480 }, height: { ideal: 480 } },
        audio: false,
      });
      setStream(mediaStream);
      setFacingMode(facing);
      setCameraActive(true);
    } catch {
      setError("Could not access camera. Please allow camera permissions.");
    }
  }, [stream]);

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

  const switchCamera = useCallback(() => {
    const newFacing: FacingMode = facingMode === "user" ? "environment" : "user";
    startCamera(newFacing);
  }, [facingMode, startCamera]);

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be smaller than 5MB.");
      return;
    }

    setError("");
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = 400;
        canvas.height = 400;
        const ctx = canvas.getContext("2d")!;
        const size = Math.min(img.width, img.height);
        const sx = (img.width - size) / 2;
        const sy = (img.height - size) / 2;
        ctx.drawImage(img, sx, sy, size, size, 0, 0, 400, 400);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        onCapture(dataUrl);
        if (cameraActive) stopCamera();
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
        data-testid="input-file-upload"
      />

      {currentPhoto && !cameraActive && (
        <div className="flex flex-col items-center gap-3">
          <img src={currentPhoto} alt="Captured" className="w-28 h-28 rounded-full object-cover border-2 border-afrocat-teal" data-testid="img-captured-photo" />
          <div className="flex gap-2 flex-wrap justify-center">
            <Button type="button" variant="outline" size="sm" onClick={() => startCamera("user")} className="border-afrocat-border text-afrocat-muted hover:bg-afrocat-white-5 text-xs" data-testid="button-retake-front">
              <Camera className="h-3 w-3 mr-1" /> Front Camera
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => startCamera("environment")} className="border-afrocat-border text-afrocat-muted hover:bg-afrocat-white-5 text-xs" data-testid="button-retake-back">
              <SwitchCamera className="h-3 w-3 mr-1" /> Back Camera
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="border-afrocat-border text-afrocat-muted hover:bg-afrocat-white-5 text-xs" data-testid="button-upload-gallery">
              <Upload className="h-3 w-3 mr-1" /> Gallery
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => { onCapture(""); onClose(); }} className="border-afrocat-border text-afrocat-red hover:bg-afrocat-red-soft text-xs" data-testid="button-remove-photo">
              <X className="h-3 w-3 mr-1" /> Remove
            </Button>
          </div>
        </div>
      )}

      {!currentPhoto && !cameraActive && (
        <div className="flex flex-col items-center gap-3">
          <div className="w-28 h-28 rounded-full bg-afrocat-white-5 border-2 border-dashed border-afrocat-border flex items-center justify-center">
            <Camera className="h-8 w-8 text-afrocat-muted" />
          </div>
          <div className="flex gap-2 flex-wrap justify-center">
            <Button type="button" variant="outline" size="sm" onClick={() => startCamera("user")} className="border-afrocat-teal text-afrocat-teal hover:bg-afrocat-teal-soft text-xs" data-testid="button-open-camera-front">
              <Camera className="h-3 w-3 mr-1" /> Front Camera
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => startCamera("environment")} className="border-afrocat-teal text-afrocat-teal hover:bg-afrocat-teal-soft text-xs" data-testid="button-open-camera-back">
              <SwitchCamera className="h-3 w-3 mr-1" /> Back Camera
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="border-afrocat-gold text-afrocat-gold hover:bg-afrocat-gold-soft text-xs" data-testid="button-upload-from-gallery">
              <Upload className="h-3 w-3 mr-1" /> Upload from Gallery
            </Button>
          </div>
        </div>
      )}

      {cameraActive && (
        <div className="flex flex-col items-center gap-3">
          <div className="relative w-48 h-48 rounded-full overflow-hidden border-2 border-afrocat-teal">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" data-testid="video-camera" />
          </div>
          <p className="text-[10px] text-afrocat-muted uppercase tracking-wider">
            {facingMode === "user" ? "Front Camera" : "Back Camera"}
          </p>
          {error && <p className="text-xs text-afrocat-red">{error}</p>}
          <div className="flex gap-2 flex-wrap justify-center">
            <Button type="button" size="sm" onClick={takePhoto} className="bg-afrocat-teal hover:bg-afrocat-teal/80 text-white text-xs" data-testid="button-capture-photo">
              <Camera className="h-3 w-3 mr-1" /> Capture
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={switchCamera} className="border-afrocat-border text-afrocat-gold text-xs" data-testid="button-switch-camera">
              <SwitchCamera className="h-3 w-3 mr-1" /> Switch
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="border-afrocat-border text-afrocat-muted text-xs" data-testid="button-upload-while-camera">
              <Upload className="h-3 w-3 mr-1" /> Gallery
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => { stopCamera(); onClose(); }} className="border-afrocat-border text-afrocat-muted text-xs" data-testid="button-cancel-camera">
              Cancel
            </Button>
          </div>
        </div>
      )}
      {error && !cameraActive && <p className="text-xs text-afrocat-red text-center">{error}</p>}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
