import { withPortAnchors } from './catalog.js';
import { validateAndConstrainObject } from './geometry.js';
import { createEntityId } from './identifiers.js';

export function placeCatalogObject({ modelTemplate, categoryId, room, id }) {
  const proposedObject = {
    id: id || createEntityId(modelTemplate.type),
    category: categoryId,
    type: modelTemplate.type,
    modelId: modelTemplate.modelId,
    name: modelTemplate.displayName,
    shape: modelTemplate.shape,
    assetUrl: modelTemplate.assetUrl,
    position: { x: 0, y: 0, z: modelTemplate.defaultScale.z / 2 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { ...modelTemplate.defaultScale },
    color: modelTemplate.color,
    ports: withPortAnchors(
      modelTemplate.ports ? structuredClone(modelTemplate.ports) : [],
      modelTemplate.modelId,
    ),
  };

  return validateAndConstrainObject(proposedObject, room);
}
