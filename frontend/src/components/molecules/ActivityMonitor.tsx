import { useState, useEffect } from 'react';
import { Activity, Keyboard, Copy, MousePointer, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ActivityEvent {
    type: 'keystroke' | 'copy' | 'paste' | 'mouse_exit' | 'tab_switch';
    timestamp: Date;
    details?: string;
}

interface ActivityMonitorProps {
    className?: string;
    onToggle?: (visible: boolean) => void;
    sessionId?: string; // Proctoring session ID for backend logging
}

export function ActivityMonitor({ className, onToggle, sessionId }: ActivityMonitorProps) {
    const [events, setEvents] = useState<ActivityEvent[]>([]);
    const [keystrokeCount, setKeystrokeCount] = useState(0);
    const [copyCount, setCopyCount] = useState(0);
    const [pasteCount, setPasteCount] = useState(0);
    const [suspiciousCount, setSuspiciousCount] = useState(0);
    const [isCollapsed, setIsCollapsed] = useState(false);

    // Helper function to log activity to backend
    const logActivityToBackend = async (type: string, details?: any) => {
        if (!sessionId) return; // Only log if we have a session

        try {
            await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/proctor/log-violation`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('candidate_token')}`
                },
                body: JSON.stringify({
                    session_id: sessionId,
                    violation_type: type,
                    violation_data: { details, timestamp: new Date().toISOString() }
                })
            });
        } catch (error) {
            console.error('Failed to log activity:', error);
        }
    };

    const toggleCollapse = () => {
        setIsCollapsed(!isCollapsed);
        onToggle?.(!isCollapsed);
    };

    // Track keystrokes
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't count modifier keys alone
            if (!['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
                setKeystrokeCount(prev => prev + 1);
                // Don't add keystrokes to event log - too noisy
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Track clipboard activity
    useEffect(() => {
        const handleCopy = () => {
            setCopyCount(prev => prev + 1);
            setSuspiciousCount(prev => prev + 1);
            addEvent({
                type: 'copy',
                timestamp: new Date(),
                details: 'Text copied to clipboard'
            });
            // Log to backend
            logActivityToBackend('copy_paste', 'Text copied to clipboard');
        };

        const handlePaste = () => {
            setPasteCount(prev => prev + 1);
            setSuspiciousCount(prev => prev + 1);
            addEvent({
                type: 'paste',
                timestamp: new Date(),
                details: 'Text pasted from clipboard'
            });
            // Log to backend
            logActivityToBackend('copy_paste', 'Text pasted from clipboard');
        };

        window.addEventListener('copy', handleCopy);
        window.addEventListener('paste', handlePaste);

        return () => {
            window.removeEventListener('copy', handleCopy);
            window.removeEventListener('paste', handlePaste);
        };
    }, []);

    // Track mouse leaving window
    useEffect(() => {
        const handleMouseLeave = () => {
            setSuspiciousCount(prev => prev + 1);
            addEvent({
                type: 'mouse_exit',
                timestamp: new Date(),
                details: 'Mouse left assessment window'
            });
            // Log to backend
            logActivityToBackend('mouse_exit', 'Mouse left assessment window');
        };

        document.addEventListener('mouseleave', handleMouseLeave);
        return () => document.removeEventListener('mouseleave', handleMouseLeave);
    }, []);

    // Track tab/window switching
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                setSuspiciousCount(prev => prev + 1);
                addEvent({
                    type: 'tab_switch',
                    timestamp: new Date(),
                    details: 'Window/tab switched'
                });
                // Log to backend
                logActivityToBackend('tab_switch', 'Window/tab switched');
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, []);

    const addEvent = (event: ActivityEvent) => {
        setEvents(prev => [event, ...prev].slice(0, 5)); // Keep last 5 events
    };

    const getEventIcon = (type: ActivityEvent['type']) => {
        switch (type) {
            case 'keystroke': return <Keyboard className="h-3 w-3" />;
            case 'copy': return <Copy className="h-3 w-3" />;
            case 'paste': return <Copy className="h-3 w-3" />;
            case 'mouse_exit': return <MousePointer className="h-3 w-3" />;
            case 'tab_switch': return <AlertTriangle className="h-3 w-3" />;
        }
    };

    const getEventColor = (type: ActivityEvent['type']) => {
        if (type === 'keystroke') return 'text-muted-foreground';
        return 'text-warning';
    };


    // Collapsed view
    if (isCollapsed) {
        return (
            <Button
                onClick={toggleCollapse}
                variant="outline"
                size="sm"
                className={cn("gap-2 shadow-lg", className)}
            >
                <Activity className="h-4 w-4" />
                <span className="text-xs">Activity</span>
                {suspiciousCount > 0 && (
                    <Badge variant="destructive" className="ml-1 text-[10px] px-1.5 py-0">
                        {suspiciousCount}
                    </Badge>
                )}
                <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
        );
    }

    return (
        <Card className={cn("p-3 space-y-3", className)}>
            {/* Header */}
            <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                <Activity className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Activity Monitor</h3>
                {suspiciousCount > 0 && (
                    <Badge variant="destructive" className="ml-auto text-[10px] px-1.5 py-0">
                        {suspiciousCount} suspicious
                    </Badge>
                )}
                <Button
                    onClick={toggleCollapse}
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 ml-auto"
                >
                    <ChevronLeft className="h-3 w-3" />
                </Button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2 p-2 rounded-md bg-muted/30">
                    <Keyboard className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                        <p className="text-[10px] text-muted-foreground">Keystrokes</p>
                        <p className="text-sm font-semibold">{keystrokeCount}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 p-2 rounded-md bg-warning/10">
                    <Copy className="h-4 w-4 text-warning" />
                    <div className="flex-1">
                        <p className="text-[10px] text-muted-foreground">Copy/Paste</p>
                        <p className="text-sm font-semibold text-warning">{copyCount + pasteCount}</p>
                    </div>
                </div>
            </div>

            {/* Recent Events */}
            <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Recent Activity</p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                    {events.length === 0 ? (
                        <p className="text-xs text-muted-foreground/50 italic py-2">No activity yet</p>
                    ) : (
                        events.map((event, idx) => (
                            <div
                                key={idx}
                                className="flex items-start gap-2 text-xs p-1.5 rounded bg-muted/20"
                            >
                                <span className={cn("mt-0.5", getEventColor(event.type))}>
                                    {getEventIcon(event.type)}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <p className={cn("font-medium", getEventColor(event.type))}>
                                        {event.type.replace('_', ' ')}
                                    </p>
                                    {event.details && (
                                        <p className="text-[10px] text-muted-foreground truncate">
                                            {event.details}
                                        </p>
                                    )}
                                </div>
                                <span className="text-[10px] text-muted-foreground tabular-nums">
                                    {event.timestamp.toLocaleTimeString('en-US', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        second: '2-digit',
                                        hour12: false
                                    })}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </Card>
    );
}
