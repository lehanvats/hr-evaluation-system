import { useState, useRef, useCallback, useEffect } from 'react';


// Types
interface AnalysisResult {
    face_detected: boolean;
    multiple_faces: boolean;
    looking_away: boolean;
    phone_detected?: boolean;
    error?: string;
}

interface UseProctoringProps {
    assessmentId?: string;
    onViolation?: (type: string, data: AnalysisResult) => void;
}

export function useProctoring({ assessmentId, onViolation }: UseProctoringProps = {}) {
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [isMonitoring, setIsMonitoring] = useState(false);
    const [status, setStatus] = useState<'active' | 'warning' | 'error' | 'idle'>('idle');
    const [lastAnalysis, setLastAnalysis] = useState<AnalysisResult | null>(null);

    const monitorInterval = useRef<NodeJS.Timeout | null>(null);

    const startSession = useCallback(async () => {
        try {
            // 1. Call backend to start session
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/proctor/session/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('candidate_token')}`
                },
                body: JSON.stringify({ assessment_id: assessmentId })
            });
            const data = await response.json();

            if (data.success) {
                setSessionId(data.session_id);
                setIsMonitoring(true);
                setStatus('active');
                return data.session_id;
            }
        } catch (e) {
            console.error("Failed to start proctoring session", e);
            setStatus('error');
        }
        return null;
    }, [assessmentId]);

    const stopSession = useCallback(async () => {
        setIsMonitoring(false);
        setStatus('idle');
        if (monitorInterval.current) {
            clearInterval(monitorInterval.current);
            monitorInterval.current = null;
        }

        if (sessionId) {
            try {
                await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/proctor/session/end`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('candidate_token')}`
                    },
                    body: JSON.stringify({ session_id: sessionId })
                });
            } catch (e) {
                console.error("Failed to end proctoring session", e);
            }
        }
    }, [sessionId]);

    const logViolation = useCallback(async (violationType: string, violationData: any) => {
        if (!sessionId) return;

        try {
            await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/proctor/log-violation`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('candidate_token')}`
                },
                body: JSON.stringify({
                    session_id: sessionId,
                    violation_type: violationType,
                    violation_data: violationData
                })
            });
        } catch (e) {
            console.error("Failed to log violation", e);
        }
    }, [sessionId]);

    const analyzeFrame = useCallback(async (base64Image: string) => {
        if (!sessionId) return;

        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/proctor/analyze-frame`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('candidate_token')}`
                },
                body: JSON.stringify({
                    session_id: sessionId,
                    image: base64Image
                })
            });

            const data = await response.json();
            if (data.success && data.analysis) {
                const result = data.analysis;
                setLastAnalysis(result);

                // Check for violations
                if (!result.face_detected) {
                    setStatus('warning');
                    logViolation('no_face', result); // Log to database
                    onViolation?.('no_face', result);
                } else if (result.multiple_faces) {
                    setStatus('warning'); // Critical
                    logViolation('multiple_faces', result); // Log to database
                    onViolation?.('multiple_faces', result);
                } else if (result.looking_away) {
                    setStatus('warning');
                    logViolation('looking_away', result); // Log to database
                    onViolation?.('looking_away', result);
                } else {
                    setStatus('active');
                }
            }
        } catch (e) {
            console.error("Frame analysis failed", e);
        }
    }, [sessionId, onViolation, logViolation]);

    // Tab Switching / Visibility Detection
    useEffect(() => {
        const handleVisibilityChange = async () => {
            if (document.hidden && sessionId) {
                // Only trigger callback, don't automatically log violation
                const violationData = {
                    face_detected: true,
                    multiple_faces: false,
                    looking_away: false,
                    error: 'Tab switch detected'
                };

                onViolation?.('tab_switch', violationData);
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, [sessionId, onViolation]);

    return {
        sessionId,
        isMonitoring,
        status,
        lastAnalysis,
        startSession,
        stopSession,
        analyzeFrame
    };
}
