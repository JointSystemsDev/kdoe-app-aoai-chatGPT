import React, { useState, useEffect } from 'react';
import { Stack } from '@fluentui/react';
import { t } from '../../utils/localization';
import styles from './ProgressiveLoader.module.css';

interface ProgressiveLoaderProps {
  isLoading: boolean;
  onTimeout?: () => void;
  timeoutDuration?: number;
}

const LOADING_STAGES = [
  { message: 'Thinking...', duration: 5000 },
  { message: 'Still processing...', duration: 7000 },
  { message: 'This is taking longer than usual...', duration: 10000 },
  { message: 'Almost there, please be patient...', duration: 0 } // Final stage
];

export const ProgressiveLoader: React.FC<ProgressiveLoaderProps> = ({
  isLoading,
  onTimeout,
  timeoutDuration = 60000 // 60 seconds default timeout
}) => {
  const [currentStage, setCurrentStage] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);

  useEffect(() => {
    if (isLoading) {
      setStartTime(Date.now());
      setCurrentStage(0);
      
      // Set up stage progression timers
      const timers: number[] = [];
      
      LOADING_STAGES.forEach((stage, index) => {
        if (stage.duration > 0) {
          const timer = setTimeout(() => {
            setCurrentStage(index + 1);
          }, stage.duration);
          timers.push(timer);
        }
      });

      // Set up timeout timer
      let timeoutTimer: number | null = null;
      if (onTimeout && timeoutDuration > 0) {
        timeoutTimer = setTimeout(() => {
          onTimeout();
        }, timeoutDuration);
      }

      // Cleanup function
      return () => {
        timers.forEach(timer => clearTimeout(timer));
        if (timeoutTimer) clearTimeout(timeoutTimer);
      };
    } else {
      setStartTime(null);
      setCurrentStage(0);
    }
  }, [isLoading, onTimeout, timeoutDuration]);

  if (!isLoading) {
    return null;
  }

  const currentMessage = LOADING_STAGES[Math.min(currentStage, LOADING_STAGES.length - 1)].message;

  return (
    <Stack className={styles.progressiveLoader}>
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}>
          <div className={styles.dot1}></div>
          <div className={styles.dot2}></div>
          <div className={styles.dot3}></div>
        </div>
        <span className={styles.loadingText}>
          {t(currentMessage)}
        </span>
      </div>
    </Stack>
  );
};
