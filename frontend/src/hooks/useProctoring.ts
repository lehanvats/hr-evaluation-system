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

    // Local violation counts (Client-side aggregation)
    const violationCountsRef = useRef<Record<string, number>>({
        no_face: 0,
        multiple_faces: 0,
        looking_away: 0,
        phone_detected: 0,
        tab_switch: 0,
        mouse_exit: 0,
        print_screen: 0,
        copy_paste: 0
    });

    const startSession = useCallback(async () => {
        setIsMonitoring(true);
        try {
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
            const response = await fetch(`${API_URL}/api/proctor/session/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('candidate_token')}`
                },
                body: JSON.stringify({
                    assessment_id: assessmentId
                })
            });

            if (response.ok) {
                const data = await response.json();
                setSessionId(data.session_id);
                // Reset counts on new session
                violationCountsRef.current = {
                    no_face: 0,
                    multiple_faces: 0,
                    looking_away: 0,
                    phone_detected: 0,
                    tab_switch: 0,
                    mouse_exit: 0,
                    print_screen: 0,
                    copy_paste: 0
                };
                setStatus('active');
                return data.session_id;
            } else {
                setStatus('error');
                return null;
            }
        } catch (error) {
            console.error('Failed to start proctoring session', error);
            setStatus('error');
            return null;
        }
    }, [assessmentId]);

    const stopSession = useCallback(async () => {
        setIsMonitoring(false);
        setStatus('idle');
        if (monitorInterval.current) {
            clearInterval(monitorInterval.current);
            monitorInterval.current = null;
        }

        try {
            // Send FINAL updated counts to backend
            console.log('📝 Submitting Proctored Session. Final Counts:', violationCountsRef.current);
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
            await fetch(`${API_URL}/api/proctor/session/end`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('candidate_token')}`
                },
                body: JSON.stringify({
                    session_id: sessionId,
                    violation_counts: violationCountsRef.current // Send the aggregated counts
                })
            });

            setSessionId(null);
        } catch (error) {
            console.error('Failed to stop proctoring session', error);
        }
    }, [sessionId]);

    const logViolation = useCallback(async (violationType: string, violationData: any) => {
        if (!sessionId) return;

        // Client-side aggregation ONLY
        if (violationCountsRef.current[violationType] !== undefined) {
            violationCountsRef.current[violationType] = (violationCountsRef.current[violationType] || 0) + 1;
        } else {
            // Handle unknown types safely
            violationCountsRef.current[violationType] = 1;
        }

        console.log(`[Proctor Local Log] ${violationType} count: ${violationCountsRef.current[violationType]}`);

        // REMOVED: Real-time DB logging
        // await fetch(...)
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
        analyzeFrame,
        logViolation // Add for client-side violation logging
    };
}
