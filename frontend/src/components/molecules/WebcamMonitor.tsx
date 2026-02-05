import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Video, Shield, AlertCircle, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface WebcamMonitorProps {
  className?: string;
  stream?: MediaStream | null; // Stream to display
  status: 'active' | 'warning' | 'error' | 'idle';
}

type MonitoringStatus = 'active' | 'warning' | 'error' | 'idle';

export const WebcamMonitor = forwardRef<HTMLVideoElement, WebcamMonitorProps>(({ className, stream, status: externalStatus }, ref) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [status, setStatus] = useState<MonitoringStatus>(externalStatus || 'active');
  const videoRef = useRef<HTMLVideoElement>(null); // Internal ref

  // Expose internal ref to parent
  useImperativeHandle(ref, () => videoRef.current as HTMLVideoElement, [stream]);

  // Assign stream to video element when stream changes
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(e => console.error("Webcam play failed", e));
    }
  }, [stream]);

  // Update status
  useEffect(() => {
    if (externalStatus) setStatus(externalStatus);
  }, [externalStatus]);

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
        {!stream ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-xs text-muted-foreground">
              Initializing Camera...
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
)