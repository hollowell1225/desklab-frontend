import { useState } from 'react';

import { getLegacyModelInfo, findModelTemplate } from '../domain/catalog.js';
import { computeDevicePowerLoad, classifyPowerLoad, toPowerValue } from '../domain/analysis.js';
import {
  commitNumericInput,
  formatNumericInputValue,
  parseLiveNumericInput,
} from '../domain/property-numbers.js';

function PropertyField({
  label,
  value,
  onChange,
  step = 0.1,
  type = 'number',
  min = undefined,
  max = undefined,
  decimals = 3,
}) {
  const [prevValue, setPrevValue] = useState(value);
  const [localVal, setLocalVal] = useState(formatNumericInputValue(value, decimals));

  if (value !== prevValue) {
    setPrevValue(value);
    setLocalVal(formatNumericInputValue(value, decimals));
  }

  const handleChange = (event) => {
    const nextValue = event.target.value;
    setLocalVal(nextValue);
    const number = parseLiveNumericInput(nextValue, { min, max });
    if (number !== null) {
      onChange(number);
    }
  };

  const handleBlur = () => {
    const number = commitNumericInput(localVal, { min, max });
    onChange(number);
    setLocalVal(formatNumericInputValue(number, decimals));
  };

  return (
    <div className="panel-field">
      <label className="panel-field-label">{label}</label>
      <div className="panel-field-content">
        {type === 'text' ? (
          <input
            type="text"
            value={value}
            onChange={event => onChange(event.target.value)}
            className="ui-input"
            style={{ width: '100%' }}
          />
        ) : (
          <input
            type="number"
            step={step}
            min={min}
            max={max}
            value={localVal === undefined ? '' : localVal}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={event => event.key === 'Enter' && handleBlur()}
            className="ui-input"
            style={{ width: '100%' }}
          />
        )}
      </div>
    </div>
  );
}

export default function PropertiesEditor({ obj, updateObject, room, onSnapToWall, objects = [], connections = [] }) {
  const isWallOutlet = obj.modelId === 'wall-outlet' || obj.type === 'outlet';
  const template = findModelTemplate(obj);

  const hasPowerInput = obj.ports?.some(p => p.type === 'ac_input' || p.type === 'dc_input') 
    || template?.ports?.some(p => p.type === 'ac_input' || p.type === 'dc_input')
    || false;
  const hasPowerOutput = obj.ports?.some(p => p.type === 'ac_output' || p.type === 'dc_output') 
    || template?.ports?.some(p => p.type === 'ac_output' || p.type === 'dc_output')
    || false;

  const wattage = obj.wattage ?? template?.wattage ?? 0;
  const maxLoad = toPowerValue(obj.maxLoad ?? template?.maxLoad);

  const currentLoad = hasPowerOutput ? computeDevicePowerLoad(obj.id, objects, connections) : 0;
  const percent = maxLoad > 0 ? Math.min(100, Math.round((currentLoad / maxLoad) * 100)) : 0;
  const loadStatus = classifyPowerLoad(currentLoad, maxLoad);
  const loadColor = loadStatus === 'overload' ? '#f44336' : loadStatus === 'warning' ? '#ff9800' : '#4caf50';

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="panel-section">
        <PropertyField type="text" label="名称" value={obj.name} onChange={value => updateObject({ name: value })} />
        <div style={{ paddingLeft: '78px', marginTop: '8px' }}>
          <div className="panel-text-readonly">
            类别: {obj.category || getLegacyModelInfo(obj.type).category}<br />
            模型: {obj.modelId || getLegacyModelInfo(obj.type).modelId}<br />
            类型: {obj.type}
          </div>
        </div>
      </div>

      {/* 电力与负载配置 */}
      {(hasPowerInput || hasPowerOutput) && (
        <div className="panel-section">
          <div className="panel-section-title">电力与负载 (Power & Load)</div>
          {hasPowerInput && (
            <PropertyField 
              label="工作功耗 (W)" 
              step={5} 
              min={0} 
              decimals={0} 
              value={wattage} 
              onChange={value => updateObject({ wattage: value })} 
            />
          )}
          {hasPowerOutput && (
            <>
              <PropertyField 
                label="安全承载 (W)" 
                step={50} 
                min={0} 
                decimals={0} 
                value={maxLoad} 
                onChange={value => updateObject({ maxLoad: value })} 
              />
              {maxLoad > 0 && (
                <div style={{ paddingLeft: '78px', marginTop: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '11px', color: '#888' }}>
                    <span>外接负载: <strong>{currentLoad}W</strong> / {maxLoad}W</span>
                    <span style={{ fontWeight: 'bold', color: loadColor }}>
                      {percent}%
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '6px', backgroundColor: '#e0e0e0', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${percent}%`,
                      height: '100%',
                      backgroundColor: loadColor,
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                  {loadStatus === 'overload' ? (
                    <div style={{ color: '#f44336', fontSize: '11px', marginTop: '6px', lineHeight: '1.3' }}>
                      ⚠️ 警告: 电源已过载！请减少外接用电器。
                    </div>
                  ) : loadStatus === 'warning' ? (
                    <div style={{ color: '#ff9800', fontSize: '11px', marginTop: '6px', lineHeight: '1.3' }}>
                      ⚠️ 提示: 负载较重，已接近承载上限。
                    </div>
                  ) : null}
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="panel-section">
        <div className="panel-section-title">位置 (Position)</div>
        <PropertyField label="X" step={0.1} decimals={3} value={obj.position.x} onChange={value => updateObject({ position: { x: value } })} />
        <PropertyField label="Y" step={0.1} decimals={3} value={obj.position.y} onChange={value => updateObject({ position: { y: value } })} />
        <PropertyField label="Z" step={0.1} decimals={3} value={obj.position.z} onChange={value => updateObject({ position: { z: value } })} />
        {isWallOutlet && (
          <button type="button" className="ui-button" onClick={onSnapToWall} style={{ width: '100%', marginTop: '8px' }}>
            吸附到最近墙面
          </button>
        )}
      </div>

      <div className="panel-section">
        <div className="panel-section-title">旋转 (Rotation)</div>
        <PropertyField label="Z 轴 (°)" step={15} min={0} max={360} decimals={1} value={obj.rotation?.z || 0} onChange={value => updateObject({ rotation: { z: value } })} />
      </div>

      <div className="panel-section">
        <div className="panel-section-title">尺寸 (Scale)</div>
        <PropertyField label="X" min={0.05} max={room.length} step={0.1} decimals={3} value={obj.scale.x} onChange={value => updateObject({ scale: { x: value } })} />
        <PropertyField label="Y" min={0.05} max={room.width} step={0.1} decimals={3} value={obj.scale.y} onChange={value => updateObject({ scale: { y: value } })} />
        <PropertyField label="Z" min={0.05} max={room.height} step={0.1} decimals={3} value={obj.scale.z} onChange={value => updateObject({ scale: { z: value } })} />
      </div>
    </div>
  );
}
