import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  MarkerType
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import QuestCustomNode from './QuestCustomNode';
import ItemPicker from './ItemPicker';
import { ModpackData } from './types';

interface QuestBuilderProps {
  data: ModpackData;
  setData: (data: ModpackData) => void;
  exportPath?: string;
}

export default function QuestBuilder({ data, setData, exportPath = "" }: QuestBuilderProps) {
  const nodeTypes = useMemo(() => ({ questNode: QuestCustomNode }), []);

  const [activeChapterId, setActiveChapterId] = useState<string>(data.chapters[0]?.id || "");
  
  // React Flow Local State
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  const [loadedChapterId, setLoadedChapterId] = useState<string>("");

  // When chapter changes, load nodes for that chapter (only ONCE per switch)
  useEffect(() => {
    if (activeChapterId !== loadedChapterId) {
      const chapter = data.chapters.find(c => c.id === activeChapterId);
      if (chapter) {
        const loadedNodes: Node[] = chapter.quests.map(q => ({
          id: q.id,
          type: 'questNode',
          position: { x: q.x, y: q.y },
          data: { 
            label: q.title, 
            description: q.description, 
            tasks: q.tasks, 
            rewards: q.rewards,
            exportPath,
            firstItem: q.tasks?.[0]?.item
          }
        }));
        setNodes(loadedNodes);
        
        const loadedEdges: Edge[] = [];
        chapter.quests.forEach(q => {
          q.dependencies.forEach(dep => {
            loadedEdges.push({
              id: `e-${dep}-${q.id}`,
              source: dep,
              target: q.id,
              type: 'smoothstep',
              animated: true,
              style: { stroke: '#4caf50', strokeWidth: 2 },
              markerEnd: { type: MarkerType.ArrowClosed, color: '#4caf50' }
            });
          });
        });
        setEdges(loadedEdges);
        setSelectedNode(null);
        setLoadedChapterId(activeChapterId);
      }
    }
  }, [activeChapterId, data.chapters, loadedChapterId, setNodes, setEdges]);

  // Sync back to App.tsx when nodes/edges change
  // In a real app we'd debounce this or have a "Save" button, but for now we just sync it carefully.
  const saveToDomain = (newNodes: Node[], newEdges: Edge[]) => {
    const newChapters = [...data.chapters];
    const cIdx = newChapters.findIndex(c => c.id === activeChapterId);
    if (cIdx >= 0) {
      newChapters[cIdx].quests = newNodes.map(n => ({
        id: n.id,
        title: n.data.label as string,
        description: n.data.description as string || "",
        x: n.position.x,
        y: n.position.y,
        tasks: n.data.tasks as any[] || [],
        rewards: n.data.rewards as any[] || [],
        dependencies: newEdges.filter(e => e.target === n.id).map(e => e.source)
      }));
      setData({ ...data, chapters: newChapters });
    }
  };

  const handleNodesChange = (changes: any) => {
    onNodesChange(changes);
    // Rough sync (might cause too many renders in complex apps, but okay for prototype)
    setTimeout(() => {
      setNodes(currentNodes => {
        setEdges(currentEdges => {
          saveToDomain(currentNodes, currentEdges);
          return currentEdges;
        });
        return currentNodes;
      });
    }, 0);
  };

  const handleEdgesChange = (changes: any) => {
    onEdgesChange(changes);
    setTimeout(() => {
      setNodes(currentNodes => {
        setEdges(currentEdges => {
          saveToDomain(currentNodes, currentEdges);
          return currentEdges;
        });
        return currentNodes;
      });
    }, 0);
  };

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => {
        const edgeParams: Edge = {
          ...params,
          id: `e-${params.source}-${params.target}`,
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#4caf50', strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#4caf50' }
        };
        const newEdges = addEdge(edgeParams, eds);
        setNodes(currentNodes => {
          saveToDomain(currentNodes, newEdges);
          return currentNodes;
        });
        return newEdges;
      });
    },
    [setEdges, setNodes]
  );

  const onNodeClick = (_: any, node: Node) => setSelectedNode(node);

  const addNode = () => {
    const newNodeId = `quest_${Date.now()}`;
    const newNode: Node = {
      id: newNodeId,
      type: 'questNode',
      position: { x: 250, y: 150 },
      data: { label: `New Quest`, description: '', tasks: [], rewards: [] },
    };
    setNodes((nds) => {
      const updated = nds.concat(newNode);
      saveToDomain(updated, edges);
      return updated;
    });
  };

  const addChapter = () => {
    const newChapterId = `chapter_${Date.now()}`;
    setData({
      ...data,
      chapters: [
        ...data.chapters, 
        { id: newChapterId, title: `New Chapter`, icon: "minecraft:stone", quests: [] }
      ]
    });
    setActiveChapterId(newChapterId);
  };

  const updateSelectedNode = (field: string, value: any) => {
    if (!selectedNode) return;
    setNodes(nds => {
      const newNodes = nds.map(n => {
        if (n.id === selectedNode.id) {
          return { ...n, data: { ...n.data, [field]: value } };
        }
        return n;
      });
      saveToDomain(newNodes, edges);
      return newNodes;
    });
    setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, [field]: value } });
  };

  return (
    <div style={{ display: 'flex', width: '100%', height: '75vh', border: '1px solid #444', borderRadius: '8px', background: '#111', overflow: 'hidden' }}>
      
      {/* CHAPTER SIDEBAR (Seitliche Untermenüs) */}
      <div style={{ width: '220px', background: '#1a1a1a', borderRight: '1px solid #333', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '15px', background: '#222', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ margin: 0, color: '#fff' }}>Chapters</h4>
          <button onClick={addChapter} style={{ padding: '4px 8px', fontSize: '0.8rem', background: '#4caf50' }}>+</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {data.chapters.map(c => (
            <div 
              key={c.id} 
              onClick={() => setActiveChapterId(c.id)}
              style={{ 
                padding: '12px 15px', 
                borderBottom: '1px solid #222', 
                cursor: 'pointer',
                background: activeChapterId === c.id ? '#2c3e50' : 'transparent',
                borderLeft: activeChapterId === c.id ? '4px solid #3498db' : '4px solid transparent',
                color: activeChapterId === c.id ? '#fff' : '#aaa'
              }}
            >
              <div style={{ fontSize: '0.9rem', fontWeight: activeChapterId === c.id ? 'bold' : 'normal' }}>{c.title}</div>
              <div style={{ fontSize: '0.7rem', color: '#888' }}>{c.icon}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CANVAS */}
      <div style={{ flex: 1, position: 'relative' }}>
        <div style={{ position: 'absolute', zIndex: 10, padding: '10px' }}>
          <button onClick={addNode} style={{ background: '#4caf50' }}>+ Add Quest</button>
        </div>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={() => setSelectedNode(null)}
          colorMode="dark"
        >
          <Controls />
          <Background gap={20} size={1} color="#333" />
        </ReactFlow>
      </div>

      {/* PROPERTIES PANEL */}
      {selectedNode && (
        <div style={{ width: '380px', background: '#1a1a1a', borderLeft: '1px solid #333', padding: '20px', overflowY: 'auto' }}>
          <h4 style={{ marginTop: 0 }}>Edit Quest</h4>
          
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', color: '#ccc', fontSize: '0.9rem' }}>Title</label>
            <input 
              value={selectedNode.data.label as string} 
              onChange={(e) => updateSelectedNode('label', e.target.value)}
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', color: '#ccc', fontSize: '0.9rem' }}>Description</label>
            <textarea 
              value={(selectedNode.data.description as string) || ""} 
              onChange={(e) => updateSelectedNode('description', e.target.value)}
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box', height: '60px', background: '#222', color: 'white', border: '1px solid #444', borderRadius: '4px' }}
            />
          </div>

          <div style={{ padding: '15px', background: '#2a2a2a', borderRadius: '6px', marginBottom: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h5 style={{ margin: 0, color: '#fff' }}>Tasks (Conditions)</h5>
              <button style={{ padding: '2px 8px', fontSize: '0.75rem', background: '#2196f3' }} onClick={() => {
                const currentTasks = (selectedNode.data.tasks as any[]) || [];
                updateSelectedNode('tasks', [...currentTasks, { task_type: 'item', item: '', count: 1 }]);
              }}>+ Task</button>
            </div>
            
            {((selectedNode.data.tasks as any[]) || []).map((task: any, idx: number) => (
              <div key={idx} style={{ display: 'flex', gap: '5px', marginBottom: '5px', background: '#111', padding: '5px', borderRadius: '4px' }}>
                <select 
                  value={task.task_type} 
                  onChange={(e) => {
                     const newTasks = [...(selectedNode.data.tasks as any[])];
                     newTasks[idx].task_type = e.target.value;
                     updateSelectedNode('tasks', newTasks);
                  }}
                  style={{ width: '80px', padding: '4px', fontSize: '0.8rem' }}
                >
                  <option value="item">Item</option>
                  <option value="checkmark">Check</option>
                </select>
                {task.task_type === 'item' && (
                  <>
                    <ItemPicker 
                      placeholder="Select item..." 
                      value={task.item || ""} 
                      onChange={(val) => {
                         const newTasks = [...(selectedNode.data.tasks as any[])];
                         newTasks[idx].item = val;
                         updateSelectedNode('tasks', newTasks);
                      }}
                      customItems={data.items}
                      extraItems={[]}
                      style={{ flex: 1 }}
                    />
                    <input 
                      type="number" 
                      value={task.count || 1} 
                      onChange={(e) => {
                         const newTasks = [...(selectedNode.data.tasks as any[])];
                         newTasks[idx].count = parseInt(e.target.value) || 1;
                         updateSelectedNode('tasks', newTasks);
                      }}
                      style={{ width: '45px', padding: '4px', fontSize: '0.8rem' }}
                    />
                  </>
                )}
                <button 
                  onClick={() => {
                     const newTasks = [...(selectedNode.data.tasks as any[])];
                     newTasks.splice(idx, 1);
                     updateSelectedNode('tasks', newTasks);
                  }}
                  style={{ background: 'transparent', color: '#f44336', padding: '0 5px' }}
                >×</button>
              </div>
            ))}
          </div>

          <div style={{ padding: '15px', background: '#2a2a2a', borderRadius: '6px', marginBottom: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h5 style={{ margin: 0, color: '#fff' }}>Rewards</h5>
              <button style={{ padding: '2px 8px', fontSize: '0.75rem', background: '#ff9800' }} onClick={() => {
                const currentRewards = (selectedNode.data.rewards as any[]) || [];
                updateSelectedNode('rewards', [...currentRewards, { reward_type: 'item', item: '', count: 1, stage: '' }]);
              }}>+ Reward</button>
            </div>
            
            {((selectedNode.data.rewards as any[]) || []).map((reward: any, idx: number) => (
              <div key={idx} style={{ display: 'flex', gap: '5px', marginBottom: '8px', background: '#111', padding: '6px', borderRadius: '4px', alignItems: 'center' }}>
                <select 
                  value={reward.reward_type} 
                  onChange={(e) => {
                     const newRewards = [...(selectedNode.data.rewards as any[])];
                     newRewards[idx].reward_type = e.target.value;
                     updateSelectedNode('rewards', newRewards);
                  }}
                  style={{ width: '85px', padding: '4px', fontSize: '0.8rem' }}
                >
                  <option value="item">Item</option>
                  <option value="stage">Stage</option>
                  <option value="table">Loot/Table</option>
                </select>
                
                {reward.reward_type === 'item' && (
                  <>
                    <ItemPicker 
                      placeholder="Select item..." 
                      value={reward.item || ""} 
                      onChange={(val) => {
                         const newRewards = [...(selectedNode.data.rewards as any[])];
                         newRewards[idx].item = val;
                         updateSelectedNode('rewards', newRewards);
                      }}
                      customItems={data.items}
                      extraItems={[]}
                      style={{ flex: 1 }}
                    />
                    <input 
                      type="number" 
                      value={reward.count || 1} 
                      onChange={(e) => {
                         const newRewards = [...(selectedNode.data.rewards as any[])];
                         newRewards[idx].count = parseInt(e.target.value) || 1;
                         updateSelectedNode('rewards', newRewards);
                      }}
                      style={{ width: '45px', padding: '4px', fontSize: '0.8rem' }}
                    />
                  </>
                )}

                {reward.reward_type === 'stage' && (
                  <select 
                    value={reward.stage || ""} 
                    onChange={(e) => {
                       const newRewards = [...(selectedNode.data.rewards as any[])];
                       newRewards[idx].stage = e.target.value;
                       updateSelectedNode('rewards', newRewards);
                    }}
                    style={{ flex: 1, padding: '4px', fontSize: '0.8rem' }}
                  >
                    <option value="">(Select Stage)</option>
                    {data.stages.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}

                {reward.reward_type === 'table' && (
                  <select 
                    value={reward.table_id || ""} 
                    onChange={(e) => {
                       const newRewards = [...(selectedNode.data.rewards as any[])];
                       newRewards[idx].table_id = e.target.value;
                       updateSelectedNode('rewards', newRewards);
                    }}
                    style={{ flex: 1, padding: '4px', fontSize: '0.8rem' }}
                  >
                    <option value="">(Select Reward Table)</option>
                    {data.reward_tables.map(t => <option key={t.id} value={t.id}>{t.title} {t.is_loot_crate ? '📦' : '🎯'}</option>)}
                  </select>
                )}

                <button 
                  onClick={() => {
                     const newRewards = [...(selectedNode.data.rewards as any[])];
                     newRewards.splice(idx, 1);
                     updateSelectedNode('rewards', newRewards);
                  }}
                  style={{ background: 'transparent', color: '#f44336', padding: '0 5px' }}
                >×</button>
              </div>
            ))}
          </div>
          
          <button onClick={() => {
             setNodes(nds => {
               const newNodes = nds.filter(n => n.id !== selectedNode.id);
               setEdges(eds => {
                 const newEdges = eds.filter(e => e.source !== selectedNode.id && e.target !== selectedNode.id);
                 saveToDomain(newNodes, newEdges);
                 return newEdges;
               });
               return newNodes;
             });
             setSelectedNode(null);
          }} style={{ background: '#f44336', width: '100%' }}>Delete Quest</button>
        </div>
      )}
    </div>
  );
}
