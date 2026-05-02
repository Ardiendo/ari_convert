import { useState, useRef, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListImages,
  useDeleteImage,
  useGenerateVideo,
  useGetJobStatus,
  useDownloadVideo,
  getListImagesQueryKey,
  getGetJobStatusQueryKey,
} from "@workspace/api-client-react";
import type {
  VideoSettings,
  VideoSettingsTransition,
  VideoSettingsSort,
} from "@workspace/api-client-react/src/generated/api.schemas";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { GlitchText, CyberCard, CommandConsole, NeonBadge } from "@/components/cyber";
import type { ConsoleLine } from "@/components/cyber";
import {
  Upload, Trash2, Image as ImageIcon, Download,
  Play, Sun, Moon, Zap, Settings, Film,
} from "lucide-react";

let lineId = 0;
function mkLine(text: string, type: ConsoleLine["type"] = "info"): ConsoleLine {
  const now = new Date();
  const ts = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}:${String(now.getSeconds()).padStart(2,"0")}`;
  return { id: ++lineId, text, type, timestamp: ts };
}

function formatBytes(b: number) {
  if (!+b) return "0 B";
  const k = 1024, s = ["B","KB","MB","GB"];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return `${parseFloat((b / Math.pow(k, i)).toFixed(1))} ${s[i]}`;
}

function NeonProgress({ value }: { value: number }) {
  const segments = 20;
  const filled = Math.round((value / 100) * segments);
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: segments }).map((_, i) => (
        <div
          key={i}
          className="flex-1 h-2 transition-all duration-300"
          style={{
            background: i < filled
              ? `linear-gradient(90deg, hsl(347 100% 50%), hsl(172 100% 47%))`
              : "hsl(240 30% 11%)",
            boxShadow: i < filled ? "0 0 6px hsl(347 100% 50% / 0.6)" : "none",
          }}
        />
      ))}
      <span className="font-mono-cyber text-xs text-primary ml-2 w-8 shrink-0">{value}%</span>
    </div>
  );
}

function KpiCard({
  label, value, icon, color = "red",
}: {
  label: string; value: string | number; icon: React.ReactNode; color?: "red" | "cyan" | "yellow";
}) {
  const colors = {
    red:    "text-[hsl(347_100%_55%)]",
    cyan:   "text-[hsl(172_100%_50%)]",
    yellow: "text-[hsl(52_100%_55%)]",
  };
  return (
    <CyberCard glow={color} className="animate-slide-in">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-[10px] font-mono-cyber tracking-widest text-muted-foreground uppercase mb-1">{label}</p>
          <p className={`text-3xl font-cyber font-bold ${colors[color]}`}>{value}</p>
        </div>
        <div className={`${colors[color]} opacity-60`}>{icon}</div>
      </div>
    </CyberCard>
  );
}

export default function Dashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDark] = useState(true);
  const [isLightMode, setIsLightMode] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", !isLightMode);
  }, [isLightMode]);

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  const [fps, setFps] = useState(30);
  const [duration, setDuration] = useState(2.0);
  const [transition, setTransition] = useState<VideoSettingsTransition>("none");
  const [transitionTime, setTransitionTime] = useState(0.5);
  const [sort, setSort] = useState<VideoSettingsSort>("name");
  const [resize, setResize] = useState("");
  const [outputFilename, setOutputFilename] = useState("ari_output.mp4");
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLine[]>([
    mkLine("ARI_CONVERT v1.0 :: SYSTEM READY", "system"),
    mkLine("Awaiting image upload...", "info"),
  ]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addLog = useCallback((text: string, type: ConsoleLine["type"] = "info") => {
    setConsoleLogs((prev) => [...prev.slice(-60), mkLine(text, type)]);
  }, []);

  const { data: imageList, isLoading: isImagesLoading } = useListImages();
  const images = imageList?.images || [];
  const imageCount = imageList?.count || 0;

  const { data: jobStatus } = useGetJobStatus({
    query: {
      refetchInterval: isPolling ? 1500 : false,
    },
  });

  const { data: downloadInfo, refetch: fetchDownloadInfo } = useDownloadVideo({
    query: { enabled: false },
  });

  const deleteImage = useDeleteImage();
  const generateVideo = useGenerateVideo();

  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!arr.length) return;
    setIsUploading(true);
    addLog(`Initiating upload of ${arr.length} file(s)...`, "system");
    try {
      for (const file of arr) {
        addLog(`Uploading: ${file.name} (${formatBytes(file.size)})`, "info");
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/video/upload", { method: "POST", body: fd });
        if (!res.ok) throw new Error("Upload failed");
        addLog(`Upload complete: ${file.name}`, "success");
      }
      queryClient.invalidateQueries({ queryKey: getListImagesQueryKey() });
      addLog(`${arr.length} image(s) loaded into memory.`, "success");
    } catch {
      addLog("Upload failed. Connection interrupted.", "error");
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [addLog, queryClient, toast]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) uploadFiles(e.target.files);
  };
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files) uploadFiles(e.dataTransfer.files);
  };

  const handleDelete = (filename: string) => {
    addLog(`Purging file: ${filename}`, "warn");
    deleteImage.mutate({ filename }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListImagesQueryKey() });
        addLog(`File purged: ${filename}`, "success");
      },
      onError: () => {
        addLog(`Failed to purge: ${filename}`, "error");
      },
    });
  };

  const handleGenerate = () => {
    if (!images.length) {
      addLog("ERROR: No images loaded. Upload required.", "error");
      return;
    }
    const settings: VideoSettings = {
      fps, duration, transition, transitionTime, sort,
      outputFilename: outputFilename || "ari_output.mp4",
      resize: resize.trim() || null,
    };
    addLog("╔══ INITIATING VIDEO SYNTHESIS ══╗", "system");
    addLog(`Images: ${images.length} | FPS: ${fps} | Duration/frame: ${duration}s`, "info");
    addLog(`Transition: ${transition} | Sort: ${sort}`, "info");
    if (resize) addLog(`Resolution override: ${resize}`, "info");

    generateVideo.mutate({ data: settings }, {
      onSuccess: () => {
        setIsPolling(true);
        queryClient.invalidateQueries({ queryKey: getGetJobStatusQueryKey() });
        addLog("Synthesis job dispatched to engine...", "system");
      },
      onError: () => {
        addLog("FATAL: Failed to dispatch synthesis job.", "error");
      },
    });
  };

  const prevStatusRef = useRef<string | null>(null);
  const prevProgressRef = useRef<string | null>(null);

  useEffect(() => {
    if (!jobStatus) return;
    const { status, progress } = jobStatus;

    if (progress && progress !== prevProgressRef.current) {
      prevProgressRef.current = progress;
      addLog(progress, status === "error" ? "error" : "info");
    }

    if (status !== prevStatusRef.current) {
      prevStatusRef.current = status;
      if (status === "done") {
        setIsPolling(false);
        fetchDownloadInfo();
        addLog("╚══ SYNTHESIS COMPLETE. OUTPUT READY. ══╝", "success");
      } else if (status === "error") {
        setIsPolling(false);
        addLog("╚══ SYNTHESIS FAILED. CHECK LOGS. ══╝", "error");
      }
    }
  }, [jobStatus, addLog, fetchDownloadInfo]);

  const isGenerating = jobStatus?.status === "running" || isPolling;
  const estimatedDuration = imageCount * duration;
  const progressVal = jobStatus?.status === "done" ? 100 : jobStatus?.status === "running" ? 50 : 0;

  const statusColor: Record<string, "red" | "cyan" | "yellow" | "gray"> = {
    idle: "gray", running: "cyan", done: "yellow", error: "red",
  };
  const currentStatusColor = statusColor[jobStatus?.status || "idle"] || "gray";

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      {/* Scanline overlay */}
      <div className="fixed inset-0 pointer-events-none z-50" style={{
        backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 4px)",
      }} />

      <div className="relative z-10 max-w-[1400px] mx-auto px-4 py-6 space-y-6">

        {/* ── Header ────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Film className="w-6 h-6 text-primary" />
              <GlitchText
                text="ARI_CONVERT"
                tag="h1"
                className="text-4xl font-cyber font-black neon-text-red tracking-widest"
              />
            </div>
            <p className="font-mono-cyber text-muted-foreground text-xs tracking-widest mt-1 ml-9">
              IMAGE_SEQUENCE <span className="text-primary">→</span> VIDEO_SYNTHESIS <span className="text-[hsl(172_100%_47%)]">// EDGE_RUNNER_TECH v1.0</span>
            </p>
          </div>
          <button
            onClick={() => setIsLightMode(!isLightMode)}
            className="p-2 border border-[hsl(240_30%_14%)] hover:border-primary transition-colors text-muted-foreground hover:text-primary"
          >
            {isLightMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
        </div>

        <div className="border-t border-[hsl(347_100%_50%/0.3)] w-full" />

        {/* ── KPI Row ───────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="Images Loaded" value={imageCount} icon={<ImageIcon className="w-6 h-6" />} color="red" />
          <KpiCard label="Est. Duration" value={estimatedDuration > 0 ? `${estimatedDuration.toFixed(1)}s` : "--"} icon={<Zap className="w-6 h-6" />} color="cyan" />
          <KpiCard label="Output FPS" value={fps} icon={<Film className="w-6 h-6" />} color="yellow" />
          <div className="animate-slide-in">
            <CyberCard glow="none" className="h-full">
              <p className="text-[10px] font-mono-cyber tracking-widest text-muted-foreground uppercase mb-2">Sys Status</p>
              <NeonBadge
                color={currentStatusColor}
                pulse={jobStatus?.status === "running"}
              >
                {jobStatus?.status || "IDLE"}
              </NeonBadge>
              {jobStatus?.status === "done" && downloadInfo?.size && (
                <p className="text-[10px] font-mono-cyber text-muted-foreground mt-1">{formatBytes(downloadInfo.size)}</p>
              )}
            </CyberCard>
          </div>
        </div>

        {/* ── Main Grid ─────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Left: Gallery + Console */}
          <div className="lg:col-span-2 space-y-4">

            {/* Upload Zone */}
            <CyberCard label="DATA_PORT // IMAGE UPLOAD" glow="red">
              <div
                className={[
                  "border-2 border-dashed p-8 text-center transition-all duration-300 cursor-pointer mt-2",
                  isDragging
                    ? "border-[hsl(172_100%_47%)] bg-[hsl(172_100%_47%/0.05)]"
                    : "border-[hsl(347_100%_50%/0.25)] hover:border-[hsl(347_100%_50%/0.6)] hover:bg-[hsl(347_100%_50%/0.03)]",
                ].join(" ")}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  type="file" multiple
                  accept="image/png,image/jpeg,image/webp,image/bmp"
                  className="hidden" ref={fileInputRef}
                  onChange={handleFileSelect}
                />
                <div className="flex flex-col items-center gap-3">
                  <div className="relative w-14 h-14 flex items-center justify-center">
                    <div className="absolute inset-0 border border-primary/30 animate-ping rounded-none" style={{ animationDuration: "2s" }} />
                    {isUploading
                      ? <div className="w-8 h-8 border-2 border-primary/20 border-t-primary" style={{ animation: "spin-glow 1s linear infinite" }} />
                      : <Upload className="w-7 h-7 text-primary" />
                    }
                  </div>
                  <div>
                    <p className="font-cyber text-sm tracking-widest text-foreground">
                      {isUploading ? "TRANSFERRING DATA..." : "JACK IN YOUR IMAGES"}
                    </p>
                    <p className="font-mono-cyber text-xs text-muted-foreground mt-1">PNG / JPG / WEBP / BMP</p>
                  </div>
                </div>
              </div>
            </CyberCard>

            {/* Image Gallery */}
            <CyberCard label="IMAGE_BANK" glow="none">
              {isImagesLoading ? (
                <div className="grid grid-cols-3 md:grid-cols-4 gap-2 mt-2">
                  {[1,2,3,4].map((i) => <Skeleton key={i} className="aspect-square bg-muted" />)}
                </div>
              ) : images.length > 0 ? (
                <div className="grid grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2 mt-2">
                  {images.map((img, idx) => (
                    <div key={img.filename} className="group relative aspect-square bg-muted overflow-hidden border border-[hsl(240_30%_14%)] hover:border-primary/50 transition-colors">
                      <div className="absolute top-1 left-1 z-10">
                        <span className="font-mono-cyber text-[8px] text-primary/70 bg-black/60 px-1">{String(idx + 1).padStart(2, "0")}</span>
                      </div>
                      <img src={img.url} alt={img.filename} className="w-full h-full object-cover" loading="lazy" />
                      <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 p-2">
                        <p className="text-white text-[9px] font-mono-cyber truncate w-full text-center">{img.filename}</p>
                        <p className="text-white/60 text-[9px] font-mono-cyber">{formatBytes(img.size)}</p>
                        <button
                          className="mt-1 p-1.5 bg-[hsl(347_100%_50%/0.2)] border border-[hsl(347_100%_50%/0.5)] text-[hsl(347_100%_60%)] hover:bg-[hsl(347_100%_50%/0.4)] transition-colors"
                          onClick={(e) => { e.stopPropagation(); handleDelete(img.filename); }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 mt-2 border border-dashed border-[hsl(240_30%_14%)]">
                  <ImageIcon className="w-10 h-10 text-muted-foreground/20 mx-auto mb-2" />
                  <p className="font-mono-cyber text-xs text-muted-foreground">NO_FILES_DETECTED</p>
                  <p className="font-mono-cyber text-[10px] text-muted-foreground/50 mt-1">Upload images to initialize</p>
                </div>
              )}
            </CyberCard>

            {/* Progress */}
            {(jobStatus?.status === "running" || jobStatus?.status === "done") && (
              <CyberCard label="SYNTHESIS_PROGRESS" glow={jobStatus.status === "done" ? "cyan" : "red"}>
                <div className="mt-2 space-y-2">
                  <NeonProgress value={progressVal} />
                  {jobStatus.status === "done" && downloadInfo?.url && (
                    <a
                      href={downloadInfo.url}
                      download={downloadInfo.filename}
                      className="flex items-center justify-center gap-2 w-full py-2.5 mt-2 bg-[hsl(172_100%_47%/0.1)] border border-[hsl(172_100%_47%/0.5)] text-[hsl(172_100%_55%)] font-cyber tracking-widest text-sm hover:bg-[hsl(172_100%_47%/0.2)] transition-all"
                    >
                      <Download className="w-4 h-4" />
                      EXTRACT VIDEO // {downloadInfo.filename}
                    </a>
                  )}
                </div>
              </CyberCard>
            )}

            {/* Console */}
            <CyberCard label="CONSOLE_OUTPUT" glow="none">
              <CommandConsole lines={consoleLogs} className="mt-2" maxHeight="220px" />
            </CyberCard>
          </div>

          {/* Right: Settings + Generate */}
          <div className="lg:col-span-1 space-y-4">
            <CyberCard label="CONFIG_PANEL" glow="yellow" className="sticky top-4">
              <div className="mt-2 space-y-4">

                <div className="space-y-1">
                  <Label className="font-mono-cyber text-[10px] tracking-widest text-muted-foreground uppercase">Sort_Order</Label>
                  <Select value={sort} onValueChange={(v) => setSort(v as VideoSettingsSort)} disabled={isGenerating}>
                    <SelectTrigger className="font-mono-cyber text-xs border-[hsl(240_30%_18%)] bg-muted h-8 rounded-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="font-mono-cyber text-xs rounded-none">
                      <SelectItem value="name">BY_NAME</SelectItem>
                      <SelectItem value="date">BY_DATE_ASC</SelectItem>
                      <SelectItem value="date_desc">BY_DATE_DESC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="font-mono-cyber text-[10px] tracking-widest text-muted-foreground uppercase">Frame_Dur</Label>
                    <div className="relative">
                      <Input
                        type="number" min={0.5} step={0.5} value={duration}
                        onChange={(e) => setDuration(parseFloat(e.target.value) || 2)}
                        disabled={isGenerating}
                        className="font-mono-cyber text-xs h-8 rounded-none border-[hsl(240_30%_18%)] bg-muted pr-6"
                      />
                      <span className="absolute right-2 top-2 text-[10px] text-primary pointer-events-none font-mono-cyber">s</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="font-mono-cyber text-[10px] tracking-widest text-muted-foreground uppercase">FPS</Label>
                    <Input
                      type="number" min={1} max={120} value={fps}
                      onChange={(e) => setFps(parseInt(e.target.value) || 30)}
                      disabled={isGenerating}
                      className="font-mono-cyber text-xs h-8 rounded-none border-[hsl(240_30%_18%)] bg-muted"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="font-mono-cyber text-[10px] tracking-widest text-muted-foreground uppercase">Transition</Label>
                  <Select value={transition} onValueChange={(v) => setTransition(v as VideoSettingsTransition)} disabled={isGenerating}>
                    <SelectTrigger className="font-mono-cyber text-xs border-[hsl(240_30%_18%)] bg-muted h-8 rounded-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="font-mono-cyber text-xs rounded-none">
                      <SelectItem value="none">NONE</SelectItem>
                      <SelectItem value="fade">FADE</SelectItem>
                      <SelectItem value="crossfade">CROSSFADE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {transition !== "none" && (
                  <div className="space-y-1">
                    <Label className="font-mono-cyber text-[10px] tracking-widest text-muted-foreground uppercase">Trans_Time</Label>
                    <div className="relative">
                      <Input
                        type="number" min={0.1} step={0.1} value={transitionTime}
                        onChange={(e) => setTransitionTime(parseFloat(e.target.value) || 0.5)}
                        disabled={isGenerating}
                        className="font-mono-cyber text-xs h-8 rounded-none border-[hsl(240_30%_18%)] bg-muted pr-6"
                      />
                      <span className="absolute right-2 top-2 text-[10px] text-primary pointer-events-none font-mono-cyber">s</span>
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <Label className="font-mono-cyber text-[10px] tracking-widest text-muted-foreground uppercase">Resolution <span className="text-muted-foreground/50">(opt)</span></Label>
                  <Input
                    placeholder="e.g. 1920x1080"
                    value={resize}
                    onChange={(e) => setResize(e.target.value)}
                    disabled={isGenerating}
                    className="font-mono-cyber text-xs h-8 rounded-none border-[hsl(240_30%_18%)] bg-muted placeholder:text-muted-foreground/30"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="font-mono-cyber text-[10px] tracking-widest text-muted-foreground uppercase">Output_File</Label>
                  <Input
                    value={outputFilename}
                    onChange={(e) => setOutputFilename(e.target.value)}
                    disabled={isGenerating}
                    className="font-mono-cyber text-xs h-8 rounded-none border-[hsl(240_30%_18%)] bg-muted"
                  />
                </div>

                <div className="pt-2 border-t border-[hsl(240_30%_14%)]">
                  <button
                    className={[
                      "w-full py-3 font-cyber font-bold tracking-widest text-sm transition-all duration-200 flex items-center justify-center gap-2",
                      images.length === 0 || isGenerating || isUploading
                        ? "bg-muted text-muted-foreground border border-[hsl(240_30%_18%)] cursor-not-allowed"
                        : "bg-primary text-white border border-primary cyber-glow-btn hover:bg-[hsl(347_100%_42%)]",
                    ].join(" ")}
                    disabled={images.length === 0 || isGenerating || isUploading}
                    onClick={handleGenerate}
                  >
                    {isGenerating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/20 border-t-white" style={{ animation: "spin-glow 1s linear infinite" }} />
                        SYNTHESIZING...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-current" />
                        EXECUTE SYNTHESIS
                      </>
                    )}
                  </button>
                </div>

                {/* Mini stats */}
                <div className="font-mono-cyber text-[10px] text-muted-foreground space-y-1 pt-1 border-t border-[hsl(240_30%_14%)]">
                  <div className="flex justify-between">
                    <span>FRAMES:</span>
                    <span className="text-foreground">{imageCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>TOTAL_DURATION:</span>
                    <span className="text-foreground">{estimatedDuration.toFixed(1)}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span>RENDER_FRAMES:</span>
                    <span className="text-foreground">{Math.round(estimatedDuration * fps)}</span>
                  </div>
                </div>
              </div>
            </CyberCard>

            {/* Quick guide */}
            <CyberCard glow="none" label="QUICK_GUIDE">
              <div className="mt-2 font-mono-cyber text-[10px] text-muted-foreground space-y-1.5">
                {[
                  ["01", "Upload images via drag & drop"],
                  ["02", "Configure FPS & duration"],
                  ["03", "Select transition effect"],
                  ["04", "Execute synthesis"],
                  ["05", "Extract output video"],
                ].map(([n, t]) => (
                  <div key={n} className="flex gap-2">
                    <span className="text-primary shrink-0">[{n}]</span>
                    <span>{t}</span>
                  </div>
                ))}
              </div>
            </CyberCard>
          </div>
        </div>

        <div className="border-t border-[hsl(240_30%_14%)] pt-2">
          <p className="font-mono-cyber text-[10px] text-muted-foreground/40 text-center tracking-widest">
            ARI_CONVERT // NIGHT_CITY_TECH © 2077 // ALL_RIGHTS_RESERVED
          </p>
        </div>
      </div>
    </div>
  );
}
