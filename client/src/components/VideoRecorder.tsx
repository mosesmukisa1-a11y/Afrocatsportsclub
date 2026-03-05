import { useState, useRef, useCallback, useEffect } from "react";
import { Video, Square, RotateCcw, Upload, X, SwitchCamera, Mic, MicOff, Camera } from "lucide-react";

type RecordingState = "idle" | "requesting" | "recording" | "recorded";

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
  const [hasAudio, setHasAudio] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopAllTracks = useCallback((s?: MediaStream | null) => {
    const target = s || stream;
    if (target) target.getTracks().forEach((t) => t.stop());
  }, [stream]);

  const startCamera = useCallback(
    async (facing: "user" | "environment" = "user") => {
      try {
        setError("");
        setRecordingState("requesting");
        stopAllTracks();

        let mediaStream: MediaStream;
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: facing === "environment" ? { exact: "environment" } : "user",
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: true,
          });
        } catch {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: facing,
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: true,
          });
        }

        setStream(mediaStream);
        setFacingMode(facing);
        setPermissionGranted(true);
        setHasAudio(mediaStream.getAudioTracks().length > 0);
        setRecordingState("idle");

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err: any) {
        setRecordingState("idle");
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          setError("Camera/microphone permission denied. Please allow access in your browser settings and try again.");
        } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
          setError("No camera or microphone found on this device.");
        } else if (err.name === "OverconstrainedError") {
          try {
            const fallbackStream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: true,
            });
            setStream(fallbackStream);
            setFacingMode("user");
            setPermissionGranted(true);
            setHasAudio(fallbackStream.getAudioTracks().length > 0);
            setRecordingState("idle");
            if (videoRef.current) {
              videoRef.current.srcObject = fallbackStream;
            }
            return;
          } catch {
            setError("Could not access camera. Please check permissions.");
          }
        } else {
          setError("Could not access camera/microphone. Please allow permissions and try again.");
        }
      }
    },
    [stopAllTracks]
  );

  useEffect(() => {
    return () => {
      stopAllTracks();
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
      stopAllTracks();
      setStream(null);
    };
    mediaRecorderRef.current = recorder;
    recorder.start(1000);
    setRecordingState("recording");
    setDuration(0);
    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
  }, [stream, stopAllTracks]);

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

  if (!permissionGranted && recordingState !== "requesting") {
    return (
      <div className="space-y-4">
        <div className="rounded-xl bg-afrocat-white-5 border border-afrocat-border p-6 text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-afrocat-teal/10 flex items-center justify-center">
              <Camera size={32} className="text-afrocat-teal" />
            </div>
          </div>
          <h3 className="text-lg font-bold text-afrocat-text">Camera & Microphone Access</h3>
          <p className="text-sm text-afrocat-muted max-w-sm mx-auto">
            To record an interview video, we need access to your camera and microphone. Your browser will ask for permission.
          </p>
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button
              onClick={() => startCamera("user")}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-afrocat-teal text-white font-bold text-sm hover:bg-afrocat-teal/90 transition-all cursor-pointer"
              data-testid="button-enable-camera"
            >
              <Camera size={16} />
              Enable Camera & Mic
            </button>
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-afrocat-white-5 border border-afrocat-border text-afrocat-muted font-bold text-sm hover:bg-afrocat-white-10 transition-all cursor-pointer"
              data-testid="button-cancel-permission"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (recordingState === "requesting") {
    return (
      <div className="rounded-xl bg-afrocat-white-5 border border-afrocat-border p-6 text-center space-y-3">
        <div className="flex justify-center">
          <div className="w-10 h-10 rounded-full border-2 border-afrocat-teal border-t-transparent animate-spin" />
        </div>
        <p className="text-sm text-afrocat-muted">Requesting camera & microphone access...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {recordingState !== "recorded" && (
        <>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <button
                onClick={() => startCamera("user")}
                disabled={recordingState === "recording"}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  facingMode === "user"
                    ? "bg-afrocat-teal text-white"
                    : "bg-afrocat-white-5 border border-afrocat-border text-afrocat-muted hover:bg-afrocat-white-10"
                } ${recordingState === "recording" ? "opacity-50 cursor-not-allowed" : ""}`}
                data-testid="button-front-camera"
              >
                <Camera size={14} /> Front Camera
              </button>
              <button
                onClick={() => startCamera("environment")}
                disabled={recordingState === "recording"}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  facingMode === "environment"
                    ? "bg-afrocat-teal text-white"
                    : "bg-afrocat-white-5 border border-afrocat-border text-afrocat-muted hover:bg-afrocat-white-10"
                } ${recordingState === "recording" ? "opacity-50 cursor-not-allowed" : ""}`}
                data-testid="button-back-camera"
              >
                <SwitchCamera size={14} /> Back Camera
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              {hasAudio ? (
                <span className="flex items-center gap-1 text-[10px] text-green-500 font-bold">
                  <Mic size={12} /> Mic On
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] text-red-400 font-bold">
                  <MicOff size={12} /> No Mic
                </span>
              )}
            </div>
          </div>
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
        </>
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

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
          <p className="text-xs text-red-400 text-center">{error}</p>
          <button
            onClick={() => startCamera(facingMode)}
            className="mt-2 mx-auto block text-xs text-afrocat-teal font-bold hover:underline cursor-pointer"
            data-testid="button-retry-permission"
          >
            Try Again
          </button>
        </div>
      )}

      <div className="flex items-center justify-center gap-2 flex-wrap">
        {recordingState === "idle" && (
          <>
            <button
              onClick={startRecording}
              disabled={!stream}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 transition-all cursor-pointer disabled:opacity-50"
              data-testid="button-start-recording"
            >
              <div className="w-3 h-3 rounded-full bg-white" /> Start Recording
            </button>
            <button
              onClick={() => {
                stopAllTracks();
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
