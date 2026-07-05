import React, { Suspense, useEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { Edges, Line, Text, useGLTF } from '@react-three/drei';

import { createCameraPoseSynchronizer } from '../domain/camera-snapshot.js';
import { getModelDefaultScale, findModelTemplate } from '../domain/catalog.js';
import { evaluateConnectionLength, getConnectionEndpoints } from '../domain/connections.js';
import { buildPowerGraph, computeDevicePowerLoad, classifyPowerLoad, toPowerValue } from '../domain/analysis.js';
import { toThreePosition, toThreeZRotation } from '../domain/coordinates.js';
import { getGenericModelAsset } from '../domain/model-assets.js';

const CABLE_COLORS = {
  power: '#e53935',
  hdmi: '#1e88e5',
  usb_c: '#43a047',
  ethernet: '#fb8c00',
  displayport: '#8e24aa',
  other: '#757575',
};

export function DeskLabAxes({ room }) {
  const size = Math.min(1.5, Math.min(room.length, room.width) * 0.25);
  const thickness = 0.015;
  const labelOffset = 0.2;

  return (
    <group position={[-room.length / 2, 0.02, -room.width / 2]}>
      <mesh position={[size / 2, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <cylinderGeometry args={[thickness, thickness, size, 8]} />
        <meshBasicMaterial color="red" />
      </mesh>
      <Text position={[size + labelOffset, 0, 0]} fontSize={0.3} color="red">X</Text>

      <mesh position={[0, 0, size / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[thickness, thickness, size, 8]} />
        <meshBasicMaterial color="green" />
      </mesh>
      <Text position={[0, 0, size + labelOffset]} fontSize={0.3} color="green">Y</Text>

      <mesh position={[0, size / 2, 0]}>
        <cylinderGeometry args={[thickness, thickness, size, 8]} />
        <meshBasicMaterial color="blue" />
      </mesh>
      <Text position={[0, size + labelOffset, 0]} fontSize={0.3} color="blue">Z</Text>
    </group>
  );
}

export function RoomWalls({ room }) {
  return (
    <group>
      <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[room.length, room.width]} />
        <meshStandardMaterial color="#90a4ae" transparent opacity={0.15} depthWrite={false} />
      </mesh>
      <mesh position={[0, room.height / 2, 0]}>
        <boxGeometry args={[room.length, room.height, room.width]} />
        <meshStandardMaterial color="#cfd8dc" transparent opacity={0.04} depthWrite={false} side={2} />
        <Edges threshold={15} color="#546e7a" />
      </mesh>
    </group>
  );
}

export function ConnectionsRenderer({ connections, objects }) {
  const objectById = new Map(objects.map(object => [object.id, object]));
  return (
    <group>
      {connections.map(connection => {
        if (!objectById.has(connection.fromObjectId) || !objectById.has(connection.toObjectId)) {
          return null;
        }
        const endpoints = getConnectionEndpoints(connection, objects, objectById);
        if (!endpoints) return null;
        const lengthStatus = evaluateConnectionLength(connection, objects, endpoints);
        return (
          <Line
            key={connection.id}
            points={[toThreePosition(endpoints.from), toThreePosition(endpoints.to)]}
            color={CABLE_COLORS[connection.cableType] || CABLE_COLORS.other}
            lineWidth={3}
            dashed={Boolean(lengthStatus && !lengthStatus.sufficient)}
            dashSize={0.15}
            gapSize={0.1}
            raycast={() => null}
          />
        );
      })}
    </group>
  );
}

export function CameraSetup({ cameraConfig, room, controlsRef, cameraRef }) {
  const { camera } = useThree();
  const poseSynchronizerRef = useRef(null);
  if (poseSynchronizerRef.current === null) {
    poseSynchronizerRef.current = createCameraPoseSynchronizer();
  }

  useEffect(() => {
    if (cameraRef) cameraRef.current = camera;
  }, [camera, cameraRef]);

  useEffect(() => {
    poseSynchronizerRef.current.sync({
      cameraConfig,
      room,
      camera,
      controls: controlsRef.current,
    });
  }, [cameraConfig, camera, controlsRef, room]);

  return null;
}

class GLTFErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.warn('GLTF Load Error, falling back to box geometry.', error);
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

const PORT_MARKER_COLORS = {
  ac_input: '#ef5350',
  ac_output: '#ef5350',
  dc_input: '#ff7043',
  dc_output: '#ff7043',
  hdmi: '#1e88e5',
  displayport: '#8e24aa',
  usb_c: '#43a047',
  ethernet: '#fb8c00',
  other: '#757575',
};

function PortMarkers({ obj }) {
  const markerRadius = Math.min(
    0.04,
    Math.max(0.012, Math.min(obj.scale.x, obj.scale.y, obj.scale.z) * 0.12)
  );
  return (
    <group>
      {(obj.ports || []).map(port => {
        const anchor = port.anchor;
        if (!anchor || !['x', 'y', 'z'].every(axis => Number.isFinite(anchor[axis]))) return null;
        const color = PORT_MARKER_COLORS[port.type] || PORT_MARKER_COLORS.other;
        return (
          <mesh
            key={port.id}
            position={[
              anchor.x * obj.scale.x,
              anchor.z * obj.scale.z,
              anchor.y * obj.scale.y,
            ]}
            raycast={() => null}
          >
            <sphereGeometry args={[markerRadius, 12, 8]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={0.35}
              depthTest={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function GLBModel({ url, scaleRatio, isSelected, isRelated, isHovered }) {
  const { scene } = useGLTF(url);
  const clonedScene = React.useMemo(() => {
    const clone = scene.clone();
    clone.traverse(child => {
      if (!child.isMesh || !child.material) return;
      child.material = child.material.clone();
      if (!child.material.emissive) return;
      if (isSelected) {
        child.material.emissive.setHex(0xffffff);
        child.material.emissiveIntensity = 0.3;
      } else if (isRelated) {
        child.material.emissive.setHex(0xffeb3b);
        child.material.emissiveIntensity = 0.4;
      } else if (isHovered) {
        child.material.emissive.setHex(0x81c784);
        child.material.emissiveIntensity = 0.2;
      } else {
        child.material.emissive.setHex(0x000000);
        child.material.emissiveIntensity = 0;
      }
    });
    return clone;
  }, [scene, isSelected, isRelated, isHovered]);

  return <primitive object={clonedScene} scale={[scaleRatio.x, scaleRatio.z, scaleRatio.y]} />;
}

function getHighlightMaterialProps({ isSelected, isRelated, isHovered }) {
  if (isSelected) return { emissiveColor: 'white', emissiveIntensity: 0.3 };
  if (isRelated) return { emissiveColor: '#ffeb3b', emissiveIntensity: 0.4 };
  if (isHovered) return { emissiveColor: '#81c784', emissiveIntensity: 0.2 };
  return { emissiveColor: 'black', emissiveIntensity: 0 };
}

function FallbackBox({ obj, materialProps }) {
  return (
    <mesh>
      <boxGeometry args={[obj.scale.x, obj.scale.z, obj.scale.y]} />
      <meshStandardMaterial
        color={obj.color}
        emissive={materialProps.emissiveColor}
        emissiveIntensity={materialProps.emissiveIntensity}
      />
    </mesh>
  );
}

function GenericMonitorModel({ obj, materialProps }) {
  const width = obj.scale.x;
  const height = obj.scale.z;
  const depth = obj.scale.y;
  const panelHeight = height * 0.68;
  const panelDepth = depth * 0.45;
  const bezelWidth = Math.min(width * 0.08, 0.045);
  const standHeight = height * 0.26;

  return (
    <group>
      <mesh position={[0, height * 0.12, 0]}>
        <boxGeometry args={[width, panelHeight, panelDepth]} />
        <meshStandardMaterial
          color={obj.color}
          emissive={materialProps.emissiveColor}
          emissiveIntensity={materialProps.emissiveIntensity}
          roughness={0.55}
        />
      </mesh>
      <mesh position={[0, height * 0.12, depth * 0.24]}>
        <boxGeometry args={[width * 0.82, panelHeight * 0.72, depth * 0.12]} />
        <meshStandardMaterial color="#111827" roughness={0.35} metalness={0.15} />
      </mesh>
      <mesh position={[0, height * 0.12, -depth * 0.33]}>
        <boxGeometry args={[width * 0.52, panelHeight * 0.42, depth * 0.24]} />
        <meshStandardMaterial color="#2f3a45" roughness={0.75} />
      </mesh>
      <mesh position={[0, -height * 0.25, 0]}>
        <boxGeometry args={[Math.max(bezelWidth, width * 0.12), standHeight, depth * 0.52]} />
        <meshStandardMaterial
          color="#3b4652"
          emissive={materialProps.emissiveColor}
          emissiveIntensity={materialProps.emissiveIntensity * 0.5}
          roughness={0.65}
        />
      </mesh>
      <mesh position={[0, -height * 0.43, 0]}>
        <boxGeometry args={[width * 0.42, height * 0.07, depth * 0.92]} />
        <meshStandardMaterial color="#202832" roughness={0.7} />
      </mesh>
    </group>
  );
}

function GenericPowerStripModel({ obj, materialProps }) {
  const width = obj.scale.x;
  const height = obj.scale.z;
  const depth = obj.scale.y;
  const socketCount = 6;
  const socketRadius = Math.min(depth * 0.14, width * 0.025);
  const socketSpacing = width * 0.72 / (socketCount - 1);

  return (
    <group>
      <mesh>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial
          color={obj.color}
          emissive={materialProps.emissiveColor}
          emissiveIntensity={materialProps.emissiveIntensity}
          roughness={0.62}
        />
      </mesh>
      <mesh position={[0, height * 0.51, 0]}>
        <boxGeometry args={[width * 0.9, height * 0.06, depth * 0.72]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.5} />
      </mesh>
      {Array.from({ length: socketCount }, (_, index) => {
        const x = -width * 0.36 + socketSpacing * index;
        return (
          <group key={index} position={[x, height * 0.56, depth * 0.12]} rotation={[-Math.PI / 2, 0, 0]}>
            <mesh position={[-socketRadius * 0.8, 0, 0]}>
              <cylinderGeometry args={[socketRadius, socketRadius, height * 0.035, 12]} />
              <meshStandardMaterial color="#202124" roughness={0.7} />
            </mesh>
            <mesh position={[socketRadius * 0.8, 0, 0]}>
              <cylinderGeometry args={[socketRadius, socketRadius, height * 0.035, 12]} />
              <meshStandardMaterial color="#202124" roughness={0.7} />
            </mesh>
          </group>
        );
      })}
      <mesh position={[-width * 0.47, height * 0.08, -depth * 0.52]}>
        <boxGeometry args={[width * 0.08, height * 0.35, depth * 0.16]} />
        <meshStandardMaterial color="#2f3a45" roughness={0.8} />
      </mesh>
    </group>
  );
}

function GenericRouterModel({ obj, materialProps }) {
  const width = obj.scale.x;
  const height = obj.scale.z;
  const depth = obj.scale.y;
  const portCount = 4;
  const portWidth = width * 0.11;
  const portSpacing = width * 0.5 / (portCount - 1);
  const antennaHeight = height * 0.85;

  return (
    <group>
      <mesh>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial
          color={obj.color}
          emissive={materialProps.emissiveColor}
          emissiveIntensity={materialProps.emissiveIntensity}
          roughness={0.58}
        />
      </mesh>
      {Array.from({ length: portCount }, (_, index) => {
        const x = -width * 0.25 + portSpacing * index;
        return (
          <mesh key={index} position={[x, height * 0.1, depth * 0.51]}>
            <boxGeometry args={[portWidth, height * 0.36, depth * 0.08]} />
            <meshStandardMaterial color="#102027" roughness={0.65} />
          </mesh>
        );
      })}
      <mesh position={[width * 0.35, height * 0.52, -depth * 0.2]} rotation={[0, 0, -0.45]}>
        <cylinderGeometry args={[width * 0.012, width * 0.012, antennaHeight, 8]} />
        <meshStandardMaterial color="#263238" roughness={0.7} />
      </mesh>
      <mesh position={[-width * 0.35, height * 0.52, -depth * 0.2]} rotation={[0, 0, 0.45]}>
        <cylinderGeometry args={[width * 0.012, width * 0.012, antennaHeight, 8]} />
        <meshStandardMaterial color="#263238" roughness={0.7} />
      </mesh>
      <mesh position={[width * 0.38, height * 0.52, depth * 0.2]}>
        <sphereGeometry args={[Math.min(width, depth) * 0.035, 12, 8]} />
        <meshStandardMaterial color="#76ff03" emissive="#76ff03" emissiveIntensity={0.45} />
      </mesh>
    </group>
  );
}

function GenericSwitchModel({ obj, materialProps }) {
  const width = obj.scale.x;
  const height = obj.scale.z;
  const depth = obj.scale.y;
  const portCount = 8;
  const portWidth = width * 0.075;
  const portSpacing = width * 0.72 / (portCount - 1);

  return (
    <group>
      <mesh>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial
          color={obj.color}
          emissive={materialProps.emissiveColor}
          emissiveIntensity={materialProps.emissiveIntensity}
          roughness={0.6}
        />
      </mesh>
      <mesh position={[0, height * 0.02, depth * 0.51]}>
        <boxGeometry args={[width * 0.88, height * 0.58, depth * 0.08]} />
        <meshStandardMaterial color="#0f172a" roughness={0.65} />
      </mesh>
      {Array.from({ length: portCount }, (_, index) => {
        const x = -width * 0.36 + portSpacing * index;
        return (
          <mesh key={index} position={[x, height * 0.08, depth * 0.56]}>
            <boxGeometry args={[portWidth, height * 0.34, depth * 0.08]} />
            <meshStandardMaterial color="#111827" roughness={0.7} />
          </mesh>
        );
      })}
      <mesh position={[-width * 0.43, height * 0.36, depth * 0.18]}>
        <sphereGeometry args={[Math.min(width, depth) * 0.018, 10, 8]} />
        <meshStandardMaterial color="#76ff03" emissive="#76ff03" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[-width * 0.36, height * 0.36, depth * 0.18]}>
        <sphereGeometry args={[Math.min(width, depth) * 0.018, 10, 8]} />
        <meshStandardMaterial color="#ffd54f" emissive="#ffd54f" emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}

function GenericUpsModel({ obj, materialProps }) {
  const width = obj.scale.x;
  const height = obj.scale.z;
  const depth = obj.scale.y;
  const ventCount = 5;
  const ventSpacing = height * 0.22 / (ventCount - 1);

  return (
    <group>
      <mesh>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial
          color={obj.color}
          emissive={materialProps.emissiveColor}
          emissiveIntensity={materialProps.emissiveIntensity}
          roughness={0.68}
        />
      </mesh>
      <mesh position={[0, height * 0.14, depth * 0.51]}>
        <boxGeometry args={[width * 0.72, height * 0.5, depth * 0.08]} />
        <meshStandardMaterial color="#263238" roughness={0.72} />
      </mesh>
      <mesh position={[0, height * 0.28, depth * 0.56]}>
        <boxGeometry args={[width * 0.42, height * 0.16, depth * 0.06]} />
        <meshStandardMaterial color="#111827" roughness={0.5} />
      </mesh>
      <mesh position={[0, height * 0.02, depth * 0.58]}>
        <cylinderGeometry args={[width * 0.13, width * 0.13, depth * 0.08, 24]} />
        <meshStandardMaterial color="#0f172a" roughness={0.55} />
      </mesh>
      <mesh position={[0, height * 0.02, depth * 0.63]}>
        <sphereGeometry args={[width * 0.04, 12, 8]} />
        <meshStandardMaterial color="#76ff03" emissive="#76ff03" emissiveIntensity={0.45} />
      </mesh>
      {Array.from({ length: ventCount }, (_, index) => (
        <mesh key={index} position={[0, -height * 0.24 + ventSpacing * index, depth * 0.56]}>
          <boxGeometry args={[width * 0.5, height * 0.025, depth * 0.06]} />
          <meshStandardMaterial color="#1f2937" roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

function GenericDesktopPcModel({ obj, materialProps }) {
  const width = obj.scale.x;
  const height = obj.scale.z;
  const depth = obj.scale.y;
  const ventRadius = Math.min(width, height) * 0.22;

  return (
    <group>
      <mesh>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial
          color={obj.color}
          emissive={materialProps.emissiveColor}
          emissiveIntensity={materialProps.emissiveIntensity}
          roughness={0.62}
        />
      </mesh>
      <mesh position={[0, 0, depth * 0.51]}>
        <boxGeometry args={[width * 0.82, height * 0.88, depth * 0.04]} />
        <meshStandardMaterial color="#20252b" roughness={0.7} />
      </mesh>
      <mesh position={[0, height * 0.27, depth * 0.55]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[ventRadius, ventRadius, depth * 0.05, 20]} />
        <meshStandardMaterial color="#111827" roughness={0.78} />
      </mesh>
      <mesh position={[-width * 0.24, -height * 0.27, depth * 0.56]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[width * 0.07, width * 0.07, depth * 0.05, 20]} />
        <meshStandardMaterial color="#0f172a" roughness={0.55} />
      </mesh>
      <mesh position={[-width * 0.24, -height * 0.27, depth * 0.6]}>
        <sphereGeometry args={[width * 0.022, 10, 8]} />
        <meshStandardMaterial color="#60a5fa" emissive="#60a5fa" emissiveIntensity={0.45} />
      </mesh>
      <mesh position={[width * 0.18, -height * 0.27, depth * 0.56]}>
        <boxGeometry args={[width * 0.16, height * 0.045, depth * 0.05]} />
        <meshStandardMaterial color="#0f172a" roughness={0.65} />
      </mesh>
      <mesh position={[width * 0.18, -height * 0.18, depth * 0.56]}>
        <boxGeometry args={[width * 0.16, height * 0.045, depth * 0.05]} />
        <meshStandardMaterial color="#0f172a" roughness={0.65} />
      </mesh>
    </group>
  );
}

function GenericMiniPcModel({ obj, materialProps }) {
  const width = obj.scale.x;
  const height = obj.scale.z;
  const depth = obj.scale.y;

  return (
    <group>
      <mesh>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial
          color={obj.color}
          emissive={materialProps.emissiveColor}
          emissiveIntensity={materialProps.emissiveIntensity}
          roughness={0.58}
        />
      </mesh>
      <mesh position={[0, height * 0.52, 0]}>
        <cylinderGeometry args={[width * 0.28, width * 0.28, height * 0.05, 24]} />
        <meshStandardMaterial color="#1f2937" roughness={0.75} />
      </mesh>
      <mesh position={[-width * 0.3, 0, depth * 0.51]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[height * 0.13, height * 0.13, depth * 0.04, 16]} />
        <meshStandardMaterial color="#111827" roughness={0.55} />
      </mesh>
      <mesh position={[-width * 0.3, 0, depth * 0.55]}>
        <sphereGeometry args={[height * 0.035, 10, 8]} />
        <meshStandardMaterial color="#60a5fa" emissive="#60a5fa" emissiveIntensity={0.45} />
      </mesh>
      <mesh position={[width * 0.03, 0, depth * 0.53]}>
        <boxGeometry args={[width * 0.18, height * 0.18, depth * 0.04]} />
        <meshStandardMaterial color="#0f172a" roughness={0.65} />
      </mesh>
      <mesh position={[width * 0.3, 0, depth * 0.53]}>
        <boxGeometry args={[width * 0.18, height * 0.18, depth * 0.04]} />
        <meshStandardMaterial color="#0f172a" roughness={0.65} />
      </mesh>
    </group>
  );
}

function GenericModel({ asset, obj, materialProps }) {
  if (asset?.id === 'generic-monitor') {
    return <GenericMonitorModel obj={obj} materialProps={materialProps} />;
  }
  if (asset?.id === 'generic-power-strip') {
    return <GenericPowerStripModel obj={obj} materialProps={materialProps} />;
  }
  if (asset?.id === 'generic-router') {
    return <GenericRouterModel obj={obj} materialProps={materialProps} />;
  }
  if (asset?.id === 'generic-switch') {
    return <GenericSwitchModel obj={obj} materialProps={materialProps} />;
  }
  if (asset?.id === 'generic-ups') {
    return <GenericUpsModel obj={obj} materialProps={materialProps} />;
  }
  if (asset?.id === 'generic-desktop-pc') {
    return <GenericDesktopPcModel obj={obj} materialProps={materialProps} />;
  }
  if (asset?.id === 'generic-mini-pc') {
    return <GenericMiniPcModel obj={obj} materialProps={materialProps} />;
  }
  return <FallbackBox obj={obj} materialProps={materialProps} />;
}

export function DeviceMesh({
  obj,
  isSelected,
  isRelated,
  isHovered,
  onClick,
  onPointerDown,
  onPointerOver,
  onPointerOut,
}) {
  const defaultScale = obj.modelId ? getModelDefaultScale(obj.category, obj.modelId) : null;
  const scaleRatio = defaultScale ? {
    x: obj.scale.x / defaultScale.x,
    y: obj.scale.y / defaultScale.y,
    z: obj.scale.z / defaultScale.z,
  } : { x: 1, y: 1, z: 1 };
  const materialProps = getHighlightMaterialProps({ isSelected, isRelated, isHovered });
  const genericAsset = obj.assetUrl ? null : getGenericModelAsset(obj.modelId);

  const renderBox = () => <FallbackBox obj={obj} materialProps={materialProps} />;

  return (
    <group
      position={toThreePosition(obj.position)}
      rotation={toThreeZRotation(obj.rotation?.z)}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    >
      {obj.assetUrl ? (
        <GLTFErrorBoundary fallback={renderBox()}>
          <Suspense fallback={renderBox()}>
            <GLBModel
              url={obj.assetUrl}
              scaleRatio={scaleRatio}
              isSelected={isSelected}
              isRelated={isRelated}
              isHovered={isHovered}
            />
          </Suspense>
        </GLTFErrorBoundary>
      ) : genericAsset ? (
        <GenericModel asset={genericAsset} obj={obj} materialProps={materialProps} />
      ) : renderBox()}
      {isSelected ? <PortMarkers obj={obj} /> : null}
    </group>
  );
}

const POWER_OUTPUT_TYPES = new Set(['ac_output', 'dc_output']);

export function PowerStatusOverlay({ objects, connections }) {
  const powerGraph = useMemo(
    () => buildPowerGraph(objects, connections),
    [objects, connections]
  );

  return (
    <group>
      {objects.map(obj => {
        const hasPowerOutput = obj.ports?.some(p => POWER_OUTPUT_TYPES.has(p.type));
        if (!hasPowerOutput) return null;

        const template = findModelTemplate(obj);
        const maxLoad = toPowerValue(obj.maxLoad ?? template?.maxLoad);
        if (maxLoad <= 0) return null;

        const currentLoad = computeDevicePowerLoad(obj.id, objects, connections, powerGraph);
        if (currentLoad <= 0) return null;

        const loadStatus = classifyPowerLoad(currentLoad, maxLoad);
        const color = loadStatus === 'overload' ? '#f44336' : loadStatus === 'warning' ? '#ff9800' : '#4caf50';
        const label = `⚡${currentLoad}W/${maxLoad}W`;

        return (
          <Text
            key={`power-${obj.id}`}
            position={[
              obj.position.x,
              obj.position.z + obj.scale.z + 0.15,
              obj.position.y,
            ]}
            fontSize={0.08}
            color={color}
            anchorX="center"
            anchorY="bottom"
            outlineWidth={0.004}
            outlineColor="#000000"
            raycast={() => null}
          >
            {label}
          </Text>
        );
      })}
    </group>
  );
}
