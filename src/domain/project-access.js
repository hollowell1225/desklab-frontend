export function canEditProject({
  projectLoaded,
  projectLoadFailed,
  recoveryPending,
}) {
  return Boolean(projectLoaded && !projectLoadFailed && !recoveryPending);
}

export function getCanvasObjectClickAction({
  projectEditable,
  connectionMode,
  objectId,
  selectedObjectId,
}) {
  if (!projectEditable) return 'ignore';
  if (connectionMode) {
    return objectId === selectedObjectId ? 'ignore' : 'choose-connection-target';
  }
  return 'select';
}

export function canStartObjectDrag({
  projectEditable,
  connectionMode,
}) {
  return Boolean(projectEditable && !connectionMode);
}
