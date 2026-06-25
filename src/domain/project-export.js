export function createProjectExport(project, {
  prefix = 'desklab-project',
  now = new Date(),
} = {}) {
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  return {
    filename: `${prefix}-${timestamp}.json`,
    mediaType: 'application/json',
    contents: JSON.stringify(project, null, 2),
  };
}
