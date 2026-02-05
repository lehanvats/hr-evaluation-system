import { useEffect, useRef, useState } from 'react';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs';

interface UseObjectDetectionProps {
    enabled: boolean;
    videoRef: React.RefObject<HTMLVideoElement>;
    onViolation: (type: string, details: any) => void;
    interval?: number;
}

export const useObjectDetection = ({
    enabled,
    videoRef,
    onViolation,
    interval = 1000
}: UseObjectDetectionProps) => {
    const [isModelLoaded, setIsModelLoaded] = useState(false);
    const modelRef = useRef<cocoSsd.ObjectDetection | null>(null);
    const detectionInterval = useRef<NodeJS.Timeout | null>(null);
    const lastDetectionTime = useRef<number>(0);

    // Load Model
    useEffect(() => {
        const loadModel = async () => {
            try {
                console.log('🤖 Loading COCO-SSD model...');
                const model = await cocoSsd.load({
                    base: 'lite_mobilenet_v2' // Lighter, faster model
                });
                modelRef.current = model;
                setIsModelLoaded(true);
                console.log('✅ COCO-SSD model loaded');
            } catch (error) {
                console.error('❌ Failed to load object detection model:', error);
            }
        };

        if (enabled && !modelRef.current) {
            loadModel();
        }
    }, [enabled]);

    // Run Detection
    useEffect(() => {
        if (!enabled || !isModelLoaded || !videoRef.current) return;

        const detectObjects = async () => {
            if (!modelRef.current || !videoRef.current || videoRef.current.readyState !== 4) return;

            try {
                const predictions = await modelRef.current.detect(videoRef.current);

                // Filter for cell phones
                const phones = predictions.filter(p => p.class === 'cell phone' && p.score > 0.6);

                if (phones.length > 0) {
                    const now = Date.now();
                    // Debounce violations (max 1 per 2 seconds)
                    if (now - lastDetectionTime.current > 2000) {
                        console.log('📱 Phone Detected:', phones[0]);
                        onViolation('phone_detected', {
                            score: phones[0].score,
                            bbox: phones[0].bbox
                        });
                        lastDetectionTime.current = now;
                    }
                }
            } catch (err) {
                console.warn('Object detection frame skipped', err);
            }
        };

        detectionInterval.current = setInterval(detectObjects, interval);

        return () => {
            if (detectionInterval.current) {
                clearInterval(detectionInterval.current);
            }
        };
    }, [enabled, isModelLoaded, interval, onViolation]);

    return { isModelLoaded };
};
