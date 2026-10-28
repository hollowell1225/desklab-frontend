import { buildDeskScene } from './scene-builder.js';

// Starting points for home users. Each one builds a placed, fully wired desk
// that the user then adjusts to match their own setup.
export const DESK_TEMPLATES = Object.freeze([
  Object.freeze({
    id: 'home-office',
    name: '家庭办公',
    description: '笔记本外接一台 27 英寸显示器，适合居家办公和学习。',
    desk: Object.freeze({ length: 1.2, depth: 0.6 }),
    devices: Object.freeze([
      Object.freeze({ modelId: 'laptop-15', count: 1 }),
      Object.freeze({ modelId: 'monitor-27', count: 1 }),
    ]),
  }),
  Object.freeze({
    id: 'desktop-dual',
    name: '台式机双屏',
    description: '台式主机配两台 24 英寸显示器，网线直连路由器。',
    desk: Object.freeze({ length: 1.4, depth: 0.7 }),
    devices: Object.freeze([
      Object.freeze({ modelId: 'desktop-pc', count: 1 }),
      Object.freeze({ modelId: 'monitor-24', count: 2 }),
      Object.freeze({ modelId: 'router', count: 1 }),
    ]),
  }),
  Object.freeze({
    id: 'gaming',
    name: '电竞桌',
    description: '台式主机配带鱼屏，加一台笔记本，网线直连路由器降低延迟。',
    desk: Object.freeze({ length: 1.6, depth: 0.8 }),
    devices: Object.freeze([
      Object.freeze({ modelId: 'desktop-pc', count: 1 }),
      Object.freeze({ modelId: 'ultrawide-monitor', count: 1 }),
      Object.freeze({ modelId: 'laptop-15', count: 1 }),
      Object.freeze({ modelId: 'router', count: 1 }),
    ]),
  }),
]);

export function buildTemplateScene(templateId) {
  const template = DESK_TEMPLATES.find(candidate => candidate.id === templateId);
  if (!template) return null;
  return buildDeskScene({ desk: template.desk, devices: template.devices });
}
