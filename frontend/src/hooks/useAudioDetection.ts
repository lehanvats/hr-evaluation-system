import { useState, useEffect, useRef, useCallback } from 'react';

interface UseAudioDetectionProps {
    enabled: boolean;
    threshold?: number; // 0 to 255, default approx 50-100 depending on sensitivity
    checkInterval?: number; // ms, default 2000
    onViolation?: (details: { type: string; level: number }) => void;
}

export function useAudioDetection({
    enabled,
    threshold = 50, // Sensitivity threshold
    checkInterval = 2000,
    onViolation
}: UseAudioDetectionProps) {
    const [isListening, setIsListening] = useState(false);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyzerRef = useRef<AnalyserNode | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    const startListening = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            audioContextRef.current = audioContext;

            const analyzer = audioContext.createAnalyser();
            analyzer.fftSize = 256;
            analyzerRef.current = analyzer;

            const source = audioContext.createMediaStreamSource(stream);
            sourceRef.current = source;
            source.connect(analyzer);

            setIsListening(true);
            console.log('🎤 Audio detection started');

        } catch (error) {
            console.error('Error accessing microphone:', error);
        }
    }, []);

    const stopListening = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }

        if (sourceRef.current) {
            sourceRef.current.disconnect();
            sourceRef.current = null;
        }

        if (analyzerRef.current) {
            analyzerRef.current = null;
        }

        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }

        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }

        setIsListening(false);
        console.log('mic stopped');
    }, []);

    // Monitoring loop
    useEffect(() => {
        if (enabled && isListening && analyzerRef.current) {
            intervalRef.current = setInterval(() => {
                if (!analyzerRef.current) return;

                const dataArray = new Uint8Array(analyzerRef.current.frequencyBinCount);
                analyzerRef.current.getByteFrequencyData(dataArray);

                // Calculate average volume
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                    sum += dataArray[i];
                }
                const average = sum / dataArray.length;

                // Log "Suspicious noise" if above threshold
                if (average > threshold) {
                    console.warn(`🔊 Suspicious noise detected! Level: ${average.toFixed(2)}`);
                    if (onViolation) {
                        onViolation({ type: 'suspicious_noise', level: average });
                    }
                }

            }, checkInterval);
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [enabled, isListening, threshold, checkInterval, onViolation]);

    // Handle enabled state changes
    useEffect(() => {
        if (enabled) {
            startListening();
        } else {
            stopListening();
        }

        return () => {
            stopListening();
        };
    }, [enabled, startListening, stopListening]);

    return { isListening };
}
