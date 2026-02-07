import { useState, useRef, useEffect } from 'react';
import { Terminal as TerminalIcon, X, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ConsoleOutputProps {
  logs: Array<{ type: 'log' | 'error' | 'info' | 'success' | 'warning'; message: string; timestamp: Date }>;
  onClear: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export function ConsoleOutput({
  logs,
  onClear,
  isExpanded = false,
  onToggleExpand
}: ConsoleOutputProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const getLogColor = (type: string) => {
    switch (type) {
      case 'error':
        return 'text-destructive';
      case 'warning':
        return 'text-warning';
      case 'success':
        return 'text-success';
      case 'info':
        return 'text-primary';
      default:
        return 'text-foreground';
    }
  };

  const getLogPrefix = (type: string) => {
    switch (type) {
      case 'error':
        return '✗';
      case 'warning':
        return '⚠';
      case 'success':
        return '✓';
      case 'info':
        return 'ℹ';
      default:
        return '›';
    }
  };

  return (
    <div className={cn(
      "flex flex-col bg-[hsl(222,47%,4%)] border-t border-border",
      isExpanded ? "h-64" : "h-32"
    )}>
      {/* Console Header */}
      <div className="h-8 flex items-center justify-between px-3 bg-muted/30 border-b border-border/50">
        <div className="flex items-center gap-2">
          <TerminalIcon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Console</span>
          {logs.length > 0 && (
            <span className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
              {logs.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onToggleExpand}
          >
            {isExpanded ? (
              <Minimize2 className="h-3 w-3" />
            ) : (
              <Maximize2 className="h-3 w-3" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onClear}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Console Output */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto p-3 font-mono text-xs space-y-1"
      >
        {logs.length === 0 ? (
          <div className="text-muted-foreground/50 italic">
            Console output will appear here...
          </div>
        ) : (
          logs.map((log, index) => (
            <div key={index} className="flex items-start gap-2">
              <span className={cn("flex-shrink-0", getLogColor(log.type))}>
                {getLogPrefix(log.type)}
              </span>
              <span className={cn("whitespace-pre-wrap", getLogColor(log.type))}>
                {log.message}
              </span>
              <span className="ml-auto text-muted-foreground/30 flex-shrink-0">
                {log.timestamp.toLocaleTimeString()}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
