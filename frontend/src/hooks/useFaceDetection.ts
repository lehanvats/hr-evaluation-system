import { useState, useEffect, useRef, useCallback } from 'react';
import * as faceapi from 'face-api.js';

export interface ViolationEvent {
    timestamp: string;
    type: 'no_face' | 'multiple_faces' | 'looking_away' | 'tab_switch' | 'window_blur';
    details?: any;
}

interface UseFaceDetectionOptions {
    enabled?: boolean;
    detectionInterval?: number; // milliseconds
    onViolation?: (event: ViolationEvent) => void;
}

export function useFaceDetection({
    enabled = false,
    detectionInterval = 1000,
    onViolation
}: UseFaceDetectionOptions = {}) {
    const [isReady, setIsReady] = useState(false);
    const [isDetecting, setIsDetecting] = useState(false);
    const [violations, setViolations] = useState<ViolationEvent[]>([]);
    const [lastDetection, setLastDetection] = useState<faceapi.FaceDetection[] | null>(null);

    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Load face-api.js models
    useEffect(() => {
        const loadModels = async () => {
            try {
                console.log('[FaceDetection] Loading models...');
                await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
                console.log('[FaceDetection] ✅ Models loaded successfully');
                setIsReady(true);
            } catch (error) {
                console.error('[FaceDetection] ❌ Failed to load models:', error);
            }
        };

        loadModels();
    }, []);

    // Start webcam
    const startCamera = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480 }
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }
            console.log('[FaceDetection] ✅ Camera started');
        } catch (error) {
            console.error('[FaceDetection] ❌ Camera access failed:', error);
        }
    }, []);

    // Stop webcam
    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        console.log('[FaceDetection] Camera stopped');
    }, []);

    // Add violation to state
    const addViolation = useCallback((type: ViolationEvent['type'], details?: any) => {
        const event: ViolationEvent = {
            timestamp: new Date().toISOString(),
            type,
            details
        };

        setViolations(prev => [...prev, event]);
        onViolation?.(event);

        console.log(`[FaceDetection] 🚨 Violation: ${type}`, details);
    }, [onViolation]);

    // Face detection loop
    useEffect(() => {
        if (!enabled || !isReady || !videoRef.current) return;

        startCamera();

        const detect = async () => {
            if (!videoRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
                return;
            }

            try {
                const detections = await faceapi.detectAllFaces(
                    videoRef.current,
                    new faceapi.TinyFaceDetectorOptions()
                );

                setLastDetection(detections);

                // Check for violations
                if (detections.length === 0) {
                    addViolation('no_face', { detectionCount: 0 });
                } else if (detections.length > 1) {
                    addViolation('multiple_faces', { detectionCount: detections.length });
                }
                // Normal state: exactly 1 face detected

            } catch (error) {
                console.error('[FaceDetection] Detection error:', error);
            }
        };

        setIsDetecting(true);
        detectionIntervalRef.current = setInterval(detect, detectionInterval);

        return () => {
            setIsDetecting(false);
            if (detectionIntervalRef.current) {
                clearInterval(detectionIntervalRef.current);
            }
            stopCamera();
        };
    }, [enabled, isReady, detectionInterval, addViolation, startCamera, stopCamera]);

    // Tab switch detection
    useEffect(() => {
        if (!enabled) return;

        const handleVisibilityChange = () => {
            if (document.hidden) {
                addViolation('tab_switch');
            }
        };

        const handleBlur = () => {
            addViolation('window_blur');
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('blur', handleBlur);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('blur', handleBlur);
        };
    }, [enabled, addViolation]);

    // Clear violations
    const clearViolations = useCallback(() => {
        setViolations([]);
    }, []);

    return {
        videoRef,
        isReady,
        isDetecting,
        violations,
        lastDetection,
        faceCount: lastDetection?.length ?? 0,
        clearViolations
    };
}
