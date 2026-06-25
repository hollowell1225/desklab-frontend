import { isProjectEnvelope } from './project-validation.js';

export function createProjectClient(request = fetch) {
  return {
    async load({ signal } = {}) {
      const response = signal
        ? await request('/api/projects/default', { signal })
        : await request('/api/projects/default');
      const project = await readResponseObject(response, '项目读取响应不是有效的 JSON 对象');
      assertResponseOk(response, project, 'Project not found or error loading');
      assertProjectEnvelope(project, '项目读取响应结构无效', { requireStoredFields: true });
      const version = requireResponseVersion(response, '项目读取响应缺少 ETag');
      return {
        project,
        version,
      };
    },
    async save(project, version = null) {
      if (typeof version !== 'string' || version.trim().length === 0) {
        throw new Error('项目版本尚未加载，已阻止保存以保护现有数据');
      }
      const headers = { 'Content-Type': 'application/json' };
      headers['If-Match'] = version;
      const response = await request('/api/projects/default', {
        method: 'PUT',
        headers,
        body: JSON.stringify(project),
      });
      const storedProject = await readResponseObject(response, '保存响应不是有效的 JSON 对象');
      assertResponseOk(response, storedProject, '保存失败');
      assertProjectEnvelope(storedProject, '保存响应结构无效', { requireStoredFields: true });
      const nextVersion = requireResponseVersion(response, '保存响应缺少 ETag');
      return {
        project: storedProject,
        version: nextVersion,
      };
    },
    async validate(project) {
      const response = await request('/api/projects/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(project),
      });
      const normalizedProject = await readResponseObject(response, '项目校验响应不是有效的 JSON 对象');
      assertResponseOk(response, normalizedProject, '项目校验失败');
      assertProjectEnvelope(normalizedProject, '项目校验响应结构无效');
      return normalizedProject;
    },
    async recoverBackup() {
      const response = await request('/api/projects/default/recover-backup', { method: 'POST' });
      const recoveredProject = await readResponseObject(response, '备份恢复响应不是有效的 JSON 对象');
      assertResponseOk(response, recoveredProject, '备份恢复失败', {
        404: '当前没有可用的上一版本备份',
        409: '当前项目仍可正常读取，无需恢复备份',
      });
      assertProjectEnvelope(recoveredProject, '备份恢复响应结构无效', { requireStoredFields: true });
      const recoveredVersion = requireResponseVersion(response, '备份恢复响应缺少 ETag');
      return {
        project: recoveredProject,
        version: recoveredVersion,
      };
    },
  };
}

async function readResponseObject(response, invalidSuccessMessage) {
  let body;
  try {
    body = await response.json();
  } catch {
    if (response.ok) throw new Error(invalidSuccessMessage);
    return {};
  }

  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    if (response.ok) throw new Error(invalidSuccessMessage);
    return {};
  }
  return body;
}

function assertProjectEnvelope(project, message, options) {
  if (!isProjectEnvelope(project, options)) {
    throw new Error(message);
  }
}

function requireResponseVersion(response, message) {
  const version = response.headers.get('ETag');
  if (!version) throw new Error(message);
  return version;
}

function assertResponseOk(response, body, fallbackMessage, statusMessages = {}) {
  if (response.ok) return;
  const conflict = response.status === 412;
  const error = new Error(conflict
    ? '项目已在另一个页面中更新。请先刷新页面，确认最新内容后再保存。'
    : statusMessages[response.status] || body.error || fallbackMessage);
  error.status = response.status;
  if (conflict) error.code = 'project_conflict';
  throw error;
}
