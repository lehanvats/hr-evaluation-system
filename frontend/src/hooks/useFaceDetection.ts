import { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';

export interface ViolationEvent {
  type: 'NO_FACE' | 'MULTIPLE_FACES' | 'FACE_TOO_FAR' | 'FACE_TURNED';
  details: string;
}

interface UseFaceDetectionOptions {
  enabled: boolean;
  detectionInterval?: number;
  onViolation: (event: ViolationEvent) => void;
}

interface UseFaceDetectionReturn {
  stream: MediaStream | null;
  videoRef: React.RefObject<HTMLVideoElement>;
  isModelLoaded: boolean;
}

export function useFaceDetection({
  enabled,
  detectionInterval = 1000,
  onViolation
}: UseFaceDetectionOptions): UseFaceDetectionReturn {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const onViolationRef = useRef(onViolation);

  // Update ref when callback changes
  useEffect(() => {
    onViolationRef.current = onViolation;
  }, [onViolation]);

  // Load Face-API Models
  useEffect(() => {
    const loadModels = async () => {
      try {
        console.log('🤖 Loading Face-API models...');
        // Load the Tiny Face Detector model from public/models
        await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
        setIsModelLoaded(true);
        console.log('✅ Face-API models loaded');
      } catch (error) {
        console.error('❌ Failed to load Face-API models:', error);
      }
    };
    loadModels();
  }, []);

  // Initialize Camera
  useEffect(() => {
    let mediaStream: MediaStream | null = null;
    let isMounted = true;

    const startCamera = async () => {
      if (!enabled) return;

      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user'
          }
        });

        if (!isMounted) {
          newStream.getTracks().forEach(track => track.stop());
          return;
        }

        mediaStream = newStream;
        setStream(newStream);

        if (videoRef.current) {
          videoRef.current.srcObject = newStream;
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
      }
    };

    if (enabled) {
      startCamera();
    } else {
      setStream(null);
    }

    return () => {
      isMounted = false;
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [enabled]);

  // Run Detection Loop
  useEffect(() => {
    if (!enabled || !isModelLoaded || !stream) return;

    const detectFaces = async () => {
      if (!videoRef.current || videoRef.current.paused || videoRef.current.ended || !isModelLoaded) return;

      try {
        // Use TinyFaceDetectorOptions for better performance on client devices
        // scoreThreshold: minimum confidence (0.5 is standard)
        // inputSize: processed image size (smaller = faster but less accurate for small faces)
        const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 });

        const detections = await faceapi.detectAllFaces(videoRef.current, options);

        // Handle Violations
        if (detections.length === 0) {
          console.log('🚨 No face detected');
          onViolationRef.current({
            type: 'NO_FACE',
            details: 'No face detected in frame'
          });
        } else if (detections.length > 1) {
          console.log('🚨 Multiple faces detected');
          onViolationRef.current({
            type: 'MULTIPLE_FACES',
            details: 'Multiple people detected'
          });
        }
      } catch (error) {
        console.warn('Face detection loop error:', error);
      }
    };

    const intervalId = setInterval(detectFaces, detectionInterval);

    return () => {
      clearInterval(intervalId);
    };
  }, [enabled, isModelLoaded, stream, detectionInterval]);

  return { stream, videoRef, isModelLoaded };
}
