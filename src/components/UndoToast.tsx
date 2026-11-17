'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Toast, ToastContainer, Button, ProgressBar } from '@/components/ui/bootstrap';

export type UndoToastData = {
  id: string;
  taskId: number;
  taskTitle: string;
  previousState: boolean;
  newState: boolean;
};

interface UndoToastProps {
  toastData: UndoToastData | null;
  onUndo: (data: UndoToastData) => Promise<void>;
  onDismiss: () => void;
}

const UNDO_DURATION_MS = 5000;

export default function UndoToast({ toastData, onUndo, onDismiss }: UndoToastProps) {
  const [remainingMs, setRemainingMs] = useState(UNDO_DURATION_MS);
  const [isUndoing, setIsUndoing] = useState(false);

  // Keep a stable ref to onDismiss so timer closures never call stale callbacks
  // or re-trigger useEffect on re-renders
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!toastData) {
      setRemainingMs(UNDO_DURATION_MS);
      return;
    }

    setRemainingMs(UNDO_DURATION_MS);
    const startTime = Date.now();
    const endTime = startTime + UNDO_DURATION_MS;

    // Progress bar animation interval (pure state update, no side-effects inside setState)
    const intervalTimer = setInterval(() => {
      const now = Date.now();
      const timeLeft = Math.max(0, endTime - now);
      setRemainingMs(timeLeft);
    }, 100);

    // Auto-dismiss timeout (fires in its own macrotask outside React's render phase)
    const dismissTimer = setTimeout(() => {
      onDismissRef.current();
    }, UNDO_DURATION_MS);

    return () => {
      clearInterval(intervalTimer);
      clearTimeout(dismissTimer);
    };
  }, [toastData]);

  if (!toastData) return null;

  const progressPercent = Math.max(0, (remainingMs / UNDO_DURATION_MS) * 100);
  const secondsLeft = Math.ceil(remainingMs / 1000);

  const handleUndoClick = async () => {
    setIsUndoing(true);
    try {
      await onUndo(toastData);
    } finally {
      setIsUndoing(false);
      onDismissRef.current();
    }
  };

  return (
    <ToastContainer
      position="bottom-center"
      className="p-3 position-fixed"
      style={{ zIndex: 9999, width: '100%', maxWidth: '480px' }}
    >
      <Toast
        show={true}
        onClose={() => onDismissRef.current()}
        className="shadow-lg border-0 bg-dark text-white w-100"
      >
        <div className="d-flex align-items-center justify-content-between p-3">
          <div className="me-2" style={{ minWidth: 0 }}>
            <div className="fw-semibold text-truncate small text-warning mb-1">
              {toastData.newState ? '✓ Task Marked Completed' : '↺ Task Reopened'}
            </div>
            <div className="small text-truncate text-light fw-medium">
              &quot;{toastData.taskTitle}&quot;
            </div>
          </div>
          <div className="d-flex align-items-center gap-2 flex-shrink-0">
            <Button
              variant="warning"
              size="sm"
              className="fw-bold px-3 py-2 text-dark shadow-sm"
              onClick={handleUndoClick}
              disabled={isUndoing}
              aria-label="Undo task state change"
            >
              {isUndoing ? 'Undoing...' : `Undo (${secondsLeft}s)`}
            </Button>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={() => onDismissRef.current()}
              aria-label="Close toast"
            />
          </div>
        </div>
        <ProgressBar
          variant="warning"
          now={progressPercent}
          style={{ height: '4px', borderRadius: 0 }}
        />
      </Toast>
    </ToastContainer>
  );
}
