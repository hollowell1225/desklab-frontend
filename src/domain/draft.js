import { isProjectEnvelope } from './project-validation.js';

export const PROJECT_DRAFT_VERSION = 1;

export function createProjectDraft(project, savedAt = new Date().toISOString()) {
  return {
    version: PROJECT_DRAFT_VERSION,
    savedAt,
    project: JSON.parse(JSON.stringify(project)),
  };
}

export function parseProjectDraft(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return null;

  try {
    const draft = JSON.parse(raw);
    if (!draft || draft.version !== PROJECT_DRAFT_VERSION) return null;
    if (typeof draft.savedAt !== 'string' || Number.isNaN(Date.parse(draft.savedAt))) return null;
    if (!isProjectEnvelope(draft.project)) return null;
    return draft;
  } catch {
    return null;
  }
}

export function projectFingerprint(project) {
  return JSON.stringify({
    room: project.room,
    objects: project.objects,
    connections: project.connections || [],
    camera: project.camera || null,
  });
}

export function isDraftDifferent(draft, project) {
  return Boolean(draft) && projectFingerprint(draft.project) !== projectFingerprint(project);
}
