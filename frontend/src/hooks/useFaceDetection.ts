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
    const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);

    // Refs
    const streamRef = useRef<MediaStream | null>(null);
    const hiddenVideoRef = useRef<HTMLVideoElement | null>(null);
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

    // Create hidden video element for face detection
    useEffect(() => {
        // Create a hidden video element that will be used by face-api.js
        const video = document.createElement('video');
        video.setAttribute('autoplay', '');
        video.setAttribute('muted', '');
        video.setAttribute('playsinline', '');
        video.style.position = 'absolute';
        video.style.left = '-9999px'; // Off-screen
        video.style.width = '640px';
        video.style.height = '480px';
        document.body.appendChild(video);
        hiddenVideoRef.current = video;

        console.log('[FaceDetection] Hidden video element created');

        return () => {
            if (hiddenVideoRef.current) {
                document.body.removeChild(hiddenVideoRef.current);
                hiddenVideoRef.current = null;
            }
        };
    }, []);

    // Start webcam
    const startCamera = useCallback(async () => {
        try {
            console.log('[FaceDetection] Requesting camera access...');
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480 }
            });
            streamRef.current = stream;
            setMediaStream(stream);

            // Attach stream to hidden video for face detection
            if (hiddenVideoRef.current) {
                hiddenVideoRef.current.srcObject = stream;
                try {
                    await hiddenVideoRef.current.play();
                    console.log('[FaceDetection] ✅ Hidden video playing');
                } catch (e) {
                    console.error('[FaceDetection] Hidden video play failed', e);
                }
            }

            console.log('[FaceDetection] ✅ Camera started, stream available');
        } catch (error) {
            console.error('[FaceDetection] ❌ Camera access failed:', error);
        }
    }, []);

    // Stop webcam
    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
            setMediaStream(null);
        }
        if (hiddenVideoRef.current) {
            hiddenVideoRef.current.srcObject = null;
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

    // Camera Lifecycle (Start/Stop independent of detection toggle)
    useEffect(() => {
        startCamera();
        return () => stopCamera();
    }, [startCamera, stopCamera]);

    // Face detection loop (Depends on enabled / isReady)
    useEffect(() => {
        if (!enabled || !isReady) {
            console.log(`[FaceDetection] Detection not starting: enabled=${enabled}, isReady=${isReady}`);
            return;
        }

        if (!hiddenVideoRef.current) {
            console.log('[FaceDetection] Hidden video not ready yet');
            return;
        }

        const detect = async () => {
            const video = hiddenVideoRef.current;
            if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) {
                return;
            }

            try {
                const detections = await faceapi.detectAllFaces(
                    video,
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

        console.log('[FaceDetection] Starting detection loop...');
        setIsDetecting(true);
        detectionIntervalRef.current = setInterval(detect, detectionInterval);

        return () => {
            setIsDetecting(false);
            if (detectionIntervalRef.current) {
                clearInterval(detectionIntervalRef.current);
            }
            console.log('[FaceDetection] Detection loop stopped');
        };
    }, [enabled, isReady, detectionInterval, addViolation]);

    // Tab switch detection removed (handled by ActivityMonitor)
    // useEffect(() => { ... }, []);

    // Clear violations
    const clearViolations = useCallback(() => {
        setViolations([]);
    }, []);

    return {
        stream: mediaStream, // For display in WebcamMonitor
        isReady,
        isDetecting,
        violations,
        lastDetection,
        faceCount: lastDetection?.length ?? 0,
        clearViolations
    };
}

