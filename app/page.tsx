"use client";

import { useState, useRef, useCallback } from "react";

type Status = "idle" | "generating" | "done" | "error";

const SAMPLE_START = "/sample-start.png";
const SAMPLE_END = "/sample-end.png";
const SAMPLE_VIDEO = "/sample-output.mp4";
const DEMO_MARKER = "data:demo";

function FrameUpload({
  label,
  preview,
  onFile,
}: {
  label: string;
  preview: string | null;
  onFile: (dataUrl: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => onFile(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) handleFile(file);
  }, []);

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
      className="relative flex flex-col items-center justify-center w-full aspect-video rounded-xl border-2 border-dashed border-zinc-600 bg-zinc-900 cursor-pointer hover:border-orange-500 hover:bg-zinc-800 transition-all overflow-hidden"
    >
      {preview ? (
        <>
          <img
            src={preview.startsWith("data:demo") ? (preview.includes(":start") ? SAMPLE_START : SAMPLE_END) : preview}
            alt={label}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/40 flex items-end p-3">
            <span className="text-xs font-mono text-white bg-black/60 px-2 py-1 rounded">{label}</span>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center gap-2 text-zinc-500 select-none">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs">Click or drag image here</p>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}

export default function Home() {
  const [startFrame, setStartFrame] = useState<string | null>(null);
  const [endFrame, setEndFrame] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);

  const loadSample = () => {
    setStartFrame(DEMO_MARKER + ":start");
    setEndFrame(DEMO_MARKER + ":end");
    setIsDemo(true);
    setStatus("idle");
    setVideoUrl(null);
    setError(null);
  };

  const pollTask = (taskId: string) => {
    const interval = setInterval(async () => {
      const res = await fetch(`/api/generate?taskId=${taskId}`);
      const data = await res.json();

      setProgress(Math.round((data.progress ?? 0) * 100));

      if (data.status === "SUCCEEDED") {
        clearInterval(interval);
        setVideoUrl(data.videoUrl);
        setStatus("done");
      } else if (data.status === "FAILED") {
        clearInterval(interval);
        setError("Generation failed. Try again.");
        setStatus("error");
      }
    }, 3000);
  };

  const generate = async () => {
    if (!startFrame || !endFrame) return;
    setStatus("generating");
    setProgress(0);
    setVideoUrl(null);
    setError(null);

    if (isDemo) {
      // Simulate progress then show pre-built video
      let p = 0;
      const tick = setInterval(() => {
        p += Math.random() * 18 + 8;
        if (p >= 100) {
          clearInterval(tick);
          setProgress(100);
          setTimeout(() => {
            setVideoUrl(SAMPLE_VIDEO);
            setStatus("done");
          }, 300);
        } else {
          setProgress(Math.round(p));
        }
      }, 400);
      return;
    }

    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startFrame, endFrame }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      setStatus("error");
      return;
    }

    pollTask(data.taskId);
  };

  const reset = () => {
    setStatus("idle");
    setVideoUrl(null);
    setError(null);
    setProgress(0);
    setIsDemo(false);
    setStartFrame(null);
    setEndFrame(null);
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-2xl flex flex-col gap-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">
            Octo<span className="text-orange-500">lapse</span> AI
          </h1>
          <p className="text-zinc-400 mt-2 text-sm">
            Turn 2 photos of your 3D print into a cinematic timelapse in 30 seconds.
          </p>
          {status === "idle" && !startFrame && (
            <button
              onClick={loadSample}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm text-zinc-300 transition-all border border-zinc-700"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Try with sample frames
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FrameUpload label="Start Frame" preview={startFrame} onFile={setStartFrame} />
          <FrameUpload label="End Frame" preview={endFrame} onFile={setEndFrame} />
        </div>

        {status === "idle" && (
          <button
            onClick={generate}
            disabled={!startFrame || !endFrame}
            className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed font-semibold text-sm transition-all"
          >
            {!startFrame || !endFrame ? "Upload both frames to generate" : "Generate Timelapse →"}
          </button>
        )}

        {status === "generating" && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-orange-500 transition-all duration-500"
                style={{ width: `${progress || 5}%` }}
              />
            </div>
            <p className="text-zinc-400 text-sm">
              Generating{progress > 0 ? ` — ${progress}%` : "..."} (takes ~30–60s)
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center gap-3">
            <p className="text-red-400 text-sm">{error}</p>
            <button onClick={reset} className="text-sm text-zinc-400 underline">
              Try again
            </button>
          </div>
        )}

        {status === "done" && videoUrl && (
          <div className="flex flex-col gap-4">
            <video src={videoUrl} autoPlay loop controls className="w-full rounded-xl bg-black" />
            <div className="flex gap-3">
              <a
                href={videoUrl}
                download="octolapse.mp4"
                className="flex-1 py-3 rounded-xl bg-orange-500 hover:bg-orange-400 font-semibold text-sm text-center transition-all"
              >
                Download MP4
              </a>
              <button
                onClick={reset}
                className="flex-1 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sm transition-all"
              >
                Generate Another
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
