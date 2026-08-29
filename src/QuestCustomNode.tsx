import { Handle, Position } from '@xyflow/react';
import ItemIcon from './ItemIcon';

export default function QuestCustomNode({ data, selected }: { data: any, selected?: boolean }) {
  const iconItem = data.icon || data.tasks?.[0]?.item || data.firstItem;

  return (
    <div style={{
      padding: '8px 12px',
      background: selected ? '#1f3a52' : '#23272e',
      border: selected ? '2px solid #3498db' : '2px solid #3e4451',
      borderRadius: '8px',
      color: 'white',
      minWidth: '140px',
      maxWidth: '220px',
      textAlign: 'center',
      boxShadow: selected ? '0 0 10px rgba(52, 152, 219, 0.5)' : '0 4px 6px rgba(0,0,0,0.3)',
      transition: 'all 0.15s ease',
      cursor: 'pointer'
    }}>
      <Handle type="target" position={Position.Left} style={{ background: '#4caf50', width: 8, height: 8 }} />
      
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '4px' }}>
        <ItemIcon item={iconItem} exportPath={data.exportPath} size={24} />
        <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#abb2bf', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {data.label}
        </div>
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '4px' }}>
        {data.tasks && data.tasks.length > 0 && (
          <span style={{ fontSize: '0.65rem', background: '#1e88e5', padding: '1px 5px', borderRadius: '4px', color: '#fff' }}>
            {data.tasks.length} {data.tasks.length === 1 ? 'Task' : 'Tasks'}
          </span>
        )}
        {data.rewards && data.rewards.length > 0 && (
          <span style={{ fontSize: '0.65rem', background: '#f59e0b', padding: '1px 5px', borderRadius: '4px', color: '#000', fontWeight: 'bold' }}>
            {data.rewards.length} {data.rewards.length === 1 ? 'Reward' : 'Rewards'}
          </span>
        )}
      </div>

      <Handle type="source" position={Position.Right} style={{ background: '#4caf50', width: 8, height: 8 }} />
    </div>
  );
}
