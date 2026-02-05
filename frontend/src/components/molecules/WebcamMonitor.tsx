import { useState, useEffect, useRef } from 'react';
import { Video, Shield, AlertCircle, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface WebcamMonitorProps {
  className?: string;
  onFrameCapture?: (base64Image: string) => void;
  status?: 'active' | 'warning' | 'error' | 'idle';
}

type MonitoringStatus = 'active' | 'warning' | 'error' | 'idle';

export function WebcamMonitor({ className, onFrameCapture, status: externalStatus }: WebcamMonitorProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [status, setStatus] = useState<MonitoringStatus>(externalStatus || 'active');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Initialize webcam stream
  useEffect(() => {
    const startWebcam = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 }
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setHasPermission(true);
        setStatus('active');
      } catch (error) {
        console.error('Failed to access webcam:', error);
        setHasPermission(false);
        setStatus('error');
      }
    };

    startWebcam();

    return () => {
      // Cleanup stream on unmount only
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // Capture frames periodically and send for analysis
  useEffect(() => {
    if (!onFrameCapture || !hasPermission) return;

    const captureFrame = () => {
      const video = videoRef.current;
      if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) return;

      try {
        // Create canvas to capture frame
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64Image = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
        onFrameCapture(base64Image);
      } catch (error) {
        console.error('Frame capture error:', error);
      }
    };

    const captureInterval = setInterval(captureFrame, 1000); // Capture every 1 second for exam monitoring


    return () => clearInterval(captureInterval);
  }, [onFrameCapture, hasPermission]);

  // Update status when external status changes
  useEffect(() => {
    if (externalStatus) {
      setStatus(externalStatus);
    }
  }, [externalStatus]);

  // Ensure video plays when minimized state changes
  useEffect(() => {
    if (videoRef.current && streamRef.current && !isMinimized) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(e => console.error('Video play error:', e));
    }
  }, [isMinimized]);

  const statusConfig = {
    active: {
      label: 'Monitoring Active',
      color: 'text-success',
      bgColor: 'bg-success/10',
      borderColor: 'border-success/30',
      icon: Shield,
    },
    warning: {
      label: 'Attention Required',
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      borderColor: 'border-warning/30',
      icon: AlertCircle,
    },
    error: {
      label: 'Connection Lost',
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      borderColor: 'border-destructive/30',
      icon: AlertCircle,
    },
    idle: {
      label: 'Standby',
      color: 'text-muted-foreground',
      bgColor: 'bg-muted/10',
      borderColor: 'border-muted/30',
      icon: Video,
    },
  };

  const currentStatus = statusConfig[status] || statusConfig.idle;
  const StatusIcon = currentStatus.icon;

  if (isMinimized) {
    return (
      <Button
        variant="secondary"
        size="sm"
        className={cn(
          "gap-2 shadow-lg border",
          currentStatus.bgColor,
          currentStatus.borderColor,
          className
        )}
        onClick={() => setIsMinimized(false)}
      >
        <div className={cn("w-2 h-2 rounded-full animate-pulse", status === 'active' ? 'bg-success' : status === 'warning' ? 'bg-warning' : 'bg-destructive')} />
        <Video className="h-4 w-4" />
        <span className="text-xs">Webcam</span>
      </Button>
    );
  }

  return (
    <div
      className={cn(
        "w-64 rounded-lg overflow-hidden shadow-2xl border",
        "bg-card/95 backdrop-blur-xl",
        currentStatus.borderColor,
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Video className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium">Webcam Preview</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setIsMinimized(true)}
        >
          <Minimize2 className="h-3 w-3" />
        </Button>
      </div>

      {/* Webcam Preview Area */}
      <div className="relative aspect-video bg-muted/50">
        {hasPermission === false ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-xs text-muted-foreground">
              Camera access required
            </p>
          </div>
        ) : (
          <>
            {/* Actual webcam video stream */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />

            {/* Recording indicator */}
            <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-1 rounded bg-destructive/90 text-destructive-foreground">
              <div className="w-2 h-2 rounded-full bg-destructive-foreground animate-pulse" />
              <span className="text-[10px] font-medium uppercase tracking-wide">REC</span>
            </div>
          </>
        )}
      </div>

      {/* Status Bar */}
      <div className={cn(
        "flex items-center gap-2 px-3 py-2",
        currentStatus.bgColor
      )}>
        <StatusIcon className={cn("h-4 w-4", currentStatus.color)} />
        <span className={cn("text-xs font-medium", currentStatus.color)}>
          System Status: {currentStatus.label}
        </span>
      </div>
    </div>
  );
}
