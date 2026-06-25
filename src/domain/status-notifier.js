const EMPTY_STATUS = Object.freeze({ text: '', type: '' });

export function createStatusNotifier(
  setStatus,
  { schedule = globalThis.setTimeout, cancel = globalThis.clearTimeout } = {},
) {
  let clearTimer = null;
  let disposed = false;

  const cancelPendingClear = () => {
    if (clearTimer === null) return;
    cancel(clearTimer);
    clearTimer = null;
  };

  return {
    show(status, duration) {
      if (disposed) return;
      cancelPendingClear();
      setStatus(status);
      if (Number.isFinite(duration) && duration > 0) {
        clearTimer = schedule(() => {
          clearTimer = null;
          if (!disposed) setStatus(EMPTY_STATUS);
        }, duration);
      }
    },
    clear() {
      if (disposed) return;
      cancelPendingClear();
      setStatus(EMPTY_STATUS);
    },
    dispose() {
      cancelPendingClear();
      disposed = true;
    },
  };
}
