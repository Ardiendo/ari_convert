import { useState, useRef, useEffect } from "react";
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
import type { VideoSettings, VideoSettingsTransition, VideoSettingsSort } from "@workspace/api-client-react/src/generated/api.schemas";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Upload, Trash2, Image as ImageIcon, Film, Settings, Download, AlertCircle, Play, Sun, Moon, CheckCircle2, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function ActivityIcon({ status }: { status: string }) {
  if (status === "running") return <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />;
  if (status === "done") return <CheckCircle2 className="w-5 h-5 text-green-500" />;
  if (status === "error") return <AlertCircle className="w-5 h-5 text-destructive" />;
  return <Play className="w-5 h-5 text-muted-foreground" />;
}

export default function Dashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  const [fps, setFps] = useState(30);
  const [duration, setDuration] = useState(2.0);
  const [transition, setTransition] = useState<VideoSettingsTransition>("none");
  const [transitionTime, setTransitionTime] = useState(0.5);
  const [sort, setSort] = useState<VideoSettingsSort>("name");
  const [resize, setResize] = useState("");
  const [outputFilename, setOutputFilename] = useState("video_final.mp4");
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: imageList, isLoading: isImagesLoading } = useListImages();
  const images = imageList?.images || [];
  const imageCount = imageList?.count || 0;

  const { data: jobStatus } = useGetJobStatus({
    query: { refetchInterval: isPolling ? 2000 : false },
  });

  const { data: downloadInfo, refetch: fetchDownloadInfo } = useDownloadVideo({
    query: { enabled: false },
  });

  const deleteImage = useDeleteImage();
  const generateVideo = useGenerateVideo();

  const uploadFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;
    setIsUploading(true);
    try {
      for (const file of fileArray) {
        if (!file.type.startsWith("image/")) continue;
        const formData = new FormData();
        formData.append("file", file);
        await fetch("/api/video/upload", { method: "POST", body: formData });
      }
      queryClient.invalidateQueries({ queryKey: getListImagesQueryKey() });
      toast({ title: "Uploaded", description: `${fileArray.length} image(s) added.` });
    } catch {
      toast({ title: "Upload Failed", description: "Could not upload images.", variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) uploadFiles(e.target.files);
  };

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) uploadFiles(e.dataTransfer.files);
  };

  const handleDelete = (filename: string) => {
    deleteImage.mutate({ filename }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListImagesQueryKey() }),
      onError: () => toast({ title: "Error", description: "Failed to delete image.", variant: "destructive" }),
    });
  };

  const handleGenerate = () => {
    if (images.length === 0) {
      toast({ title: "No Images", description: "Upload at least one image.", variant: "destructive" });
      return;
    }
    const settings: VideoSettings = {
      fps, duration, transition, transitionTime, sort,
      outputFilename: outputFilename || "video_final.mp4",
      resize: resize.trim() || null,
    };
    generateVideo.mutate({ data: settings }, {
      onSuccess: () => {
        setIsPolling(true);
        queryClient.invalidateQueries({ queryKey: getGetJobStatusQueryKey() });
        toast({ title: "Started", description: "Video generation has begun." });
      },
      onError: () => toast({ title: "Error", description: "Failed to start generation.", variant: "destructive" }),
    });
  };

  useEffect(() => {
    if (jobStatus?.status === "done") {
      setIsPolling(false);
      fetchDownloadInfo();
      toast({ title: "Done!", description: "Your video is ready to download." });
    } else if (jobStatus?.status === "error") {
      setIsPolling(false);
      toast({ title: "Failed", description: jobStatus.error || "Generation failed.", variant: "destructive" });
    }
  }, [jobStatus?.status]);

  const isGenerating = jobStatus?.status === "running" || isPolling;
  const estimatedDuration = imageCount * duration;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 font-sans">
      <div className="max-w-[1400px] mx-auto space-y-6">

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Film className="w-8 h-8 text-primary" />
              Creator Studio
            </h1>
            <p className="text-muted-foreground mt-1">Convert your images into videos automatically.</p>
          </div>
          <Button variant="outline" size="icon" onClick={() => setIsDark(!isDark)}>
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Uploaded Images</p>
                  <p className="text-3xl font-bold">{imageCount}</p>
                </div>
                <ImageIcon className="w-5 h-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Estimated Duration</p>
                  <p className="text-3xl font-bold">
                    {estimatedDuration > 0 ? `~${estimatedDuration.toFixed(1)}s` : "--"}
                  </p>
                </div>
                <Clock className="w-5 h-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  <div className="mt-1">
                    {jobStatus?.status === "running" ? (
                      <Badge className="bg-blue-500 hover:bg-blue-600">Running</Badge>
                    ) : jobStatus?.status === "done" ? (
                      <Badge className="bg-green-500 hover:bg-green-600">Done</Badge>
                    ) : jobStatus?.status === "error" ? (
                      <Badge variant="destructive">Error</Badge>
                    ) : (
                      <Badge variant="secondary">Idle</Badge>
                    )}
                  </div>
                </div>
                <ActivityIcon status={jobStatus?.status || "idle"} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Output Size</p>
                  <p className="text-3xl font-bold">
                    {jobStatus?.status === "done" && downloadInfo?.size
                      ? formatBytes(downloadInfo.size)
                      : "--"}
                  </p>
                </div>
                <Download className="w-5 h-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Image Gallery</CardTitle>
                <CardDescription>Upload and manage the images for your video.</CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  className={[
                    "border-2 border-dashed rounded-xl p-8 text-center transition-colors mb-6 cursor-pointer",
                    isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
                  ].join(" ")}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    type="file"
                    multiple
                    accept="image/png,image/jpeg,image/webp,image/bmp"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                  />
                  <div className="flex flex-col items-center justify-center space-y-3">
                    <div className="p-3 bg-primary/10 rounded-full">
                      {isUploading
                        ? <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                        : <Upload className="w-6 h-6 text-primary" />
                      }
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">
                        {isUploading ? "Uploading..." : "Click or drag & drop images here"}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">PNG, JPG, WEBP, BMP</p>
                    </div>
                  </div>
                </div>

                {isImagesLoading ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="aspect-square rounded-lg" />)}
                  </div>
                ) : images.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {images.map((img) => (
                      <div key={img.filename} className="group relative aspect-square rounded-lg border bg-muted overflow-hidden">
                        <img
                          src={img.url}
                          alt={img.filename}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2">
                          <p className="text-white text-xs font-medium truncate w-full text-center mb-1">{img.filename}</p>
                          <p className="text-white/70 text-xs mb-3">{formatBytes(img.size)}</p>
                          <Button
                            variant="destructive"
                            size="icon"
                            className="h-8 w-8 rounded-full"
                            onClick={(e) => { e.stopPropagation(); handleDelete(img.filename); }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 border rounded-lg bg-muted/20">
                    <ImageIcon className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground">No images uploaded yet.</p>
                    <p className="text-sm text-muted-foreground/70 mt-1">Upload images above to get started.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Job Status</CardTitle>
                <CardDescription>Track video generation progress.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">
                    {jobStatus?.status === "idle" && "Ready to generate"}
                    {jobStatus?.status === "running" && "Processing video..."}
                    {jobStatus?.status === "done" && "Video ready!"}
                    {jobStatus?.status === "error" && "Generation failed"}
                    {!jobStatus && "Ready to generate"}
                  </span>
                  <span className="text-muted-foreground text-xs">{jobStatus?.progress || ""}</span>
                </div>

                <Progress
                  value={
                    jobStatus?.status === "done" ? 100
                    : jobStatus?.status === "running" ? 50
                    : 0
                  }
                  className="h-2"
                />

                {jobStatus?.error && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md flex gap-2 items-start text-destructive">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <p className="text-sm">{jobStatus.error}</p>
                  </div>
                )}

                {jobStatus?.status === "done" && downloadInfo?.url && (
                  <div className="pt-2 flex justify-end">
                    <a href={downloadInfo.url} download={downloadInfo.filename}>
                      <Button className="bg-green-600 hover:bg-green-700 text-white gap-2">
                        <Download className="w-4 h-4" />
                        Download Video ({downloadInfo.filename})
                      </Button>
                    </a>
                  </div>
                )}

                {jobStatus?.startedAt && (
                  <p className="text-xs text-muted-foreground">
                    Started: {new Date(jobStatus.startedAt).toLocaleTimeString()}
                    {jobStatus.finishedAt && ` · Finished: ${new Date(jobStatus.finishedAt).toLocaleTimeString()}`}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Video Settings
                </CardTitle>
                <CardDescription>Configure how your video is created.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Sort Order</Label>
                  <Select value={sort} onValueChange={(v) => setSort(v as VideoSettingsSort)} disabled={isGenerating}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name">By name</SelectItem>
                      <SelectItem value="date">By date (oldest first)</SelectItem>
                      <SelectItem value="date_desc">By date (newest first)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Duration / Image</Label>
                    <div className="relative">
                      <Input
                        type="number" min={0.5} step={0.5}
                        value={duration}
                        onChange={(e) => setDuration(parseFloat(e.target.value) || 2)}
                        disabled={isGenerating}
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-muted-foreground pointer-events-none">s</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>FPS</Label>
                    <Input
                      type="number" min={1} max={120}
                      value={fps}
                      onChange={(e) => setFps(parseInt(e.target.value) || 30)}
                      disabled={isGenerating}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Transition</Label>
                  <Select value={transition} onValueChange={(v) => setTransition(v as VideoSettingsTransition)} disabled={isGenerating}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="fade">Fade</SelectItem>
                      <SelectItem value="crossfade">Crossfade</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {transition !== "none" && (
                  <div className="space-y-2">
                    <Label>Transition Time</Label>
                    <div className="relative">
                      <Input
                        type="number" min={0.1} step={0.1}
                        value={transitionTime}
                        onChange={(e) => setTransitionTime(parseFloat(e.target.value) || 0.5)}
                        disabled={isGenerating}
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-muted-foreground pointer-events-none">s</span>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Resolution <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input
                    placeholder="e.g. 1920x1080"
                    value={resize}
                    onChange={(e) => setResize(e.target.value)}
                    disabled={isGenerating}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Output Filename</Label>
                  <Input
                    value={outputFilename}
                    onChange={(e) => setOutputFilename(e.target.value)}
                    disabled={isGenerating}
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full h-11 text-base font-medium"
                  size="lg"
                  disabled={images.length === 0 || isGenerating || isUploading}
                  onClick={handleGenerate}
                >
                  {isGenerating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2 fill-current" />
                      Generate Video
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
