import { useState, useRef, useCallback, useEffect } from "react";
import { Video, Square, Play, RotateCcw, Upload, X, SwitchCamera } from "lucide-react";

type RecordingState = "idle" | "recording" | "recorded";

export function VideoRecorder({
  onVideoReady,
  onClose,
}: {
  onVideoReady: (file: File) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [duration, setDuration] = useState(0);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCamera = useCallback(
    async (facing: "user" | "environment" = "user") => {
      try {
        setError("");
        if (stream) {
          stream.getTracks().forEach((t) => t.stop());
        }
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true,
        });
        setStream(mediaStream);
        setFacingMode(facing);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch {
        setError("Could not access camera/microphone. Please allow permissions.");
      }
    },
    [stream]
  );

  useEffect(() => {
    startCamera("user");
    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    };
  }, []);

  useEffect(() => {
    if (stream && videoRef.current && recordingState !== "recorded") {
      videoRef.current.srcObject = stream;
    }
  }, [stream, recordingState]);

  const switchCamera = useCallback(() => {
    if (recordingState === "recording") return;
    const newFacing = facingMode === "user" ? "environment" : "user";
    startCamera(newFacing);
  }, [facingMode, startCamera, recordingState]);

  const startRecording = useCallback(() => {
    if (!stream) return;
    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : MediaRecorder.isTypeSupported("video/webm")
        ? "video/webm"
        : "video/mp4";

    const recorder = new MediaRecorder(stream, { mimeType });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      setRecordedBlob(blob);
      const url = URL.createObjectURL(blob);
      setRecordedUrl(url);
      setRecordingState("recorded");
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    };
    mediaRecorderRef.current = recorder;
    recorder.start(1000);
    setRecordingState("recording");
    setDuration(0);
    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
  }, [stream]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const retake = useCallback(() => {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedBlob(null);
    setRecordedUrl(null);
    setRecordingState("idle");
    setDuration(0);
    startCamera(facingMode);
  }, [recordedUrl, facingMode, startCamera]);

  const confirmVideo = useCallback(() => {
    if (!recordedBlob) return;
    const ext = recordedBlob.type.includes("mp4") ? "mp4" : "webm";
    const file = new File([recordedBlob], `interview-recording-${Date.now()}.${ext}`, {
      type: recordedBlob.type,
    });
    onVideoReady(file);
  }, [recordedBlob, onVideoReady]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-3">
      {recordingState !== "recorded" && (
        <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            data-testid="video-recorder-preview"
          />
          {recordingState === "recording" && (
            <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 rounded-full px-3 py-1">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-white text-xs font-bold">{formatTime(duration)}</span>
            </div>
          )}
        </div>
      )}

      {recordingState === "recorded" && recordedUrl && (
        <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
          <video
            ref={previewRef}
            src={recordedUrl}
            controls
            playsInline
            className="w-full h-full object-cover"
            data-testid="video-recorder-playback"
          />
          <div className="absolute top-3 left-3 bg-black/60 rounded-full px-3 py-1">
            <span className="text-white text-xs font-bold">{formatTime(duration)}</span>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-afrocat-red text-center">{error}</p>}

      <div className="flex items-center justify-center gap-2 flex-wrap">
        {recordingState === "idle" && (
          <>
            <button
              onClick={startRecording}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 transition-all cursor-pointer"
              data-testid="button-start-recording"
            >
              <div className="w-3 h-3 rounded-full bg-white" /> Record
            </button>
            <button
              onClick={switchCamera}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-afrocat-white-5 border border-afrocat-border text-afrocat-muted font-bold text-sm hover:bg-afrocat-white-10 transition-all cursor-pointer"
              data-testid="button-switch-camera-recorder"
            >
              <SwitchCamera className="w-4 h-4" /> Flip
            </button>
            <button
              onClick={() => {
                if (stream) stream.getTracks().forEach((t) => t.stop());
                onClose();
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-afrocat-white-5 border border-afrocat-border text-afrocat-muted font-bold text-sm hover:bg-afrocat-white-10 transition-all cursor-pointer"
              data-testid="button-cancel-recording"
            >
              <X className="w-4 h-4" /> Cancel
            </button>
          </>
        )}

        {recordingState === "recording" && (
          <button
            onClick={stopRecording}
            className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 transition-all cursor-pointer animate-pulse"
            data-testid="button-stop-recording"
          >
            <Square className="w-4 h-4 fill-white" /> Stop Recording
          </button>
        )}

        {recordingState === "recorded" && (
          <>
            <button
              onClick={confirmVideo}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-afrocat-teal text-white font-bold text-sm hover:bg-afrocat-teal/90 transition-all cursor-pointer"
              data-testid="button-use-recording"
            >
              <Upload className="w-4 h-4" /> Use This Video
            </button>
            <button
              onClick={retake}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-afrocat-white-5 border border-afrocat-border text-afrocat-muted font-bold text-sm hover:bg-afrocat-white-10 transition-all cursor-pointer"
              data-testid="button-retake-recording"
            >
              <RotateCcw className="w-4 h-4" /> Retake
            </button>
            <button
              onClick={() => {
                if (recordedUrl) URL.revokeObjectURL(recordedUrl);
                onClose();
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-afrocat-white-5 border border-afrocat-border text-afrocat-muted font-bold text-sm hover:bg-afrocat-white-10 transition-all cursor-pointer"
              data-testid="button-discard-recording"
            >
              <X className="w-4 h-4" /> Discard
            </button>
          </>
        )}
      </div>
    </div>
  );
}
