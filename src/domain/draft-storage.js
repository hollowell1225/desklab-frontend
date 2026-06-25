import { parseProjectDraft } from './draft.js';

export function createProjectDraftStorage(getStorage, key) {
  let safeToClear = true;

  return {
    read() {
      try {
        const rawDraft = getStorage().getItem(key);
        if (rawDraft === null || rawDraft === '') {
          safeToClear = true;
          return { ok: true, draft: null };
        }

        const draft = parseProjectDraft(rawDraft);
        if (!draft) {
          safeToClear = false;
          return {
            ok: false,
            operation: 'parse',
            error: new Error('本地草稿无法解析或版本不受支持'),
            draft: null,
          };
        }

        safeToClear = true;
        return { ok: true, draft };
      } catch (error) {
        safeToClear = false;
        return { ok: false, operation: 'read', error, draft: null };
      }
    },
    write(draft) {
      try {
        getStorage().setItem(key, JSON.stringify(draft));
        safeToClear = true;
        return { ok: true };
      } catch (error) {
        safeToClear = false;
        return { ok: false, operation: 'write', error };
      }
    },
    clear() {
      if (!safeToClear) {
        return {
          ok: false,
          operation: 'clear-blocked',
          error: new Error('本地草稿读取失败，已阻止清理以保留恢复材料'),
        };
      }

      try {
        getStorage().removeItem(key);
        return { ok: true };
      } catch (error) {
        return { ok: false, operation: 'clear', error };
      }
    },
  };
}
