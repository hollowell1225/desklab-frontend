import React, { Suspense, useEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { Edges, Line, Text, useGLTF } from '@react-three/drei';

import { createCameraPoseSynchronizer } from '../domain/camera-snapshot.js';
import { getModelDefaultScale, findModelTemplate } from '../domain/catalog.js';
import { evaluateConnectionLength, getConnectionEndpoints } from '../domain/connections.js';
import { buildPowerGraph, computeDevicePowerLoad, classifyPowerLoad, toPowerValue } from '../domain/analysis.js';
import { toThreePosition, toThreeZRotation } from '../domain/coordinates.js';

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

  const renderBox = () => {
    let emissiveColor = 'black';
    let emissiveIntensity = 0;
    if (isSelected) {
      emissiveColor = 'white';
      emissiveIntensity = 0.3;
    } else if (isRelated) {
      emissiveColor = '#ffeb3b';
      emissiveIntensity = 0.4;
    } else if (isHovered) {
      emissiveColor = '#81c784';
      emissiveIntensity = 0.2;
    }
    return (
      <>
        <boxGeometry args={[obj.scale.x, obj.scale.z, obj.scale.y]} />
        <meshStandardMaterial color={obj.color} emissive={emissiveColor} emissiveIntensity={emissiveIntensity} />
      </>
    );
  };

  return (
    <mesh
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
      ) : renderBox()}
      {isSelected ? <PortMarkers obj={obj} /> : null}
    </mesh>
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
