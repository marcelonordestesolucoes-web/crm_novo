import React, { useState, useCallback, useRef } from 'react';
import {
  Background,
  BackgroundVariant,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  getBezierPath,
  MarkerType,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Plus, Trash2 } from 'lucide-react';
import FlowNodeCard from './FlowNodeCard';
import FlowBlockLibrary from './FlowBlockLibrary';

const nodeTypes = {
  flowNode: FlowNodeCard
};

function DeletableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  data
}) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition
  });

  const [hoverPos, setHoverPos] = useState(null);
  const timeoutRef = useRef(null);
  const { screenToFlowPosition } = useReactFlow();

  const handleMouseMove = useCallback((event) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    const pos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    setHoverPos(pos);
  }, [screenToFlowPosition]);

  const handleMouseLeave = useCallback(() => {
    timeoutRef.current = setTimeout(() => {
      setHoverPos(null);
    }, 150);
  }, []);

  const handleButtonEnter = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} />
      {/* Caminho invisível para capturar os eventos do mouse ao longo de toda a linha */}
      <path
        d={edgePath}
        fill="none"
        strokeOpacity={0}
        strokeWidth={24}
        className="react-flow__edge-interaction cursor-pointer"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseEnter={handleMouseMove}
      />
      
      {hoverPos && (
        <EdgeLabelRenderer>
          <button
            type="button"
            onMouseEnter={handleButtonEnter}
            onMouseLeave={handleMouseLeave}
            onClick={(event) => {
              event.stopPropagation();
              data?.onDelete?.(data.edge);
            }}
            className="nodrag nopan absolute z-[1000] flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-red-200 bg-white text-red-500 shadow-lg shadow-red-500/10 transition-transform hover:scale-110 hover:border-red-300 hover:bg-red-50"
            style={{
              left: `${hoverPos.x}px`,
              top: `${hoverPos.y}px`,
              pointerEvents: 'all'
            }}
            title="Remover ligacao"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

const edgeTypes = {
  deletable: DeletableEdge
};

function toneFromHandle(handle) {
  if (handle === 'true') return 'true';
  if (handle === 'retry') return 'retry';
  if (handle === 'false') return 'false';
  return 'default';
}

function buildReactFlowEdges(edges = [], onDeleteEdge) {
  return edges.map((edge, index) => {
    const tone = toneFromHandle(edge.sourceHandle || edge.label);

    return {
      id: `${edge.from}-${edge.to}-${edge.sourceHandle || edge.label || 'default'}-${index}`,
      source: edge.from,
      target: edge.to,
      sourceHandle: edge.sourceHandle || edge.label || null,
      targetHandle: edge.targetHandle || null,
      type: 'deletable',
      animated: tone !== 'default',
      data: {
        edge,
        onDelete: onDeleteEdge
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 16,
        height: 16,
        color: tone === 'true' ? '#10b981' : tone === 'retry' ? '#f59e0b' : tone === 'false' ? '#f43f5e' : '#335cff'
      },
      style: {
        strokeWidth: tone === 'default' ? 2.25 : 2.5,
        stroke: tone === 'true' ? '#10b981' : tone === 'retry' ? '#f59e0b' : tone === 'false' ? '#f43f5e' : '#335cff'
      },
      label: tone === 'true' ? 'Valido' : tone === 'retry' ? 'Tentar' : tone === 'false' ? 'Falha' : ''
    };
  });
}

function FlowCanvasInner({
  nodes,
  edges,
  selectedNodeId,
  blockMap,
  libraryGroups,
  onSelectNode,
  onUpdateNodeConfig,
  onDuplicateNode,
  onRemoveNode,
  onQuickAdd,
  onAddBranch,
  onMoveNode,
  onConnectNodes,
  onDeleteEdges,
  insertMenu,
  onChooseInsertType,
  onCloseInsertMenu
}) {
  const reactFlowNodes = React.useMemo(
    () => nodes.map((node) => ({
      id: node.id,
      type: 'flowNode',
      position: node.position,
        data: {
          node,
        meta: blockMap[node.type],
        onSelect: onSelectNode,
        onUpdateNodeConfig,
        onDuplicate: onDuplicateNode,
        onRemove: onRemoveNode,
        onQuickAdd,
        onAddBranch
      },
      selected: selectedNodeId === node.id
    })),
    [nodes, selectedNodeId, blockMap, onSelectNode, onUpdateNodeConfig, onDuplicateNode, onRemoveNode, onQuickAdd, onAddBranch]
  );

  const handleEdgesDelete = React.useCallback((deletedEdges) => {
    const serialized = deletedEdges.map((edge) => ({
      from: edge.source,
      to: edge.target,
      sourceHandle: edge.sourceHandle || null,
      targetHandle: edge.targetHandle || null,
      label: edge.sourceHandle || null
    }));
    onDeleteEdges(serialized);
  }, [onDeleteEdges]);

  const handleDeleteSingleEdge = React.useCallback((edge) => {
    if (!edge) return;
    onDeleteEdges([{
      from: edge.from,
      to: edge.to,
      sourceHandle: edge.sourceHandle || edge.label || null,
      targetHandle: edge.targetHandle || null,
      label: edge.label || edge.sourceHandle || null
    }]);
  }, [onDeleteEdges]);

  const reactFlowEdges = React.useMemo(
    () => buildReactFlowEdges(edges, handleDeleteSingleEdge),
    [edges, handleDeleteSingleEdge]
  );

  const handleNodesChange = React.useCallback((changes) => {
    changes.forEach((change) => {
      if (change.type === 'position' && change.position && !change.dragging) {
        onMoveNode(change.id, change.position);
      }
    });
  }, [onMoveNode]);

  const handleConnect = React.useCallback((connection) => {
    onConnectNodes({
      from: connection.source,
      to: connection.target,
      sourceHandle: connection.sourceHandle || null,
      targetHandle: connection.targetHandle || null,
      label: connection.sourceHandle || null
    });
  }, [onConnectNodes]);

  return (
    <div className="rounded-lg border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(247,250,255,0.9),rgba(250,247,255,0.9))] shadow-[0_18px_44px_rgba(15,23,42,0.08)] backdrop-blur-2xl overflow-hidden min-h-[88vh]">
      <div className="flex items-center justify-between gap-4 border-b border-white/60 px-3 py-2">
        <div className="flex items-baseline gap-3">
          <p className="text-[9px] font-black uppercase text-slate-400">Canvas</p>
          <h3 className="text-base font-black tracking-tight text-slate-950">Builder visual</h3>
        </div>
        <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-black uppercase text-slate-500">
          {nodes.length} blocos • {edges.length} conexões
        </div>
      </div>

      <div className="relative h-[calc(88vh-36px)] min-h-[820px]">
        <ReactFlow
          nodes={reactFlowNodes}
          edges={reactFlowEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={handleNodesChange}
          onConnect={handleConnect}
          onEdgesDelete={handleEdgesDelete}
          onNodeClick={(_, node) => onSelectNode(node.id)}
          deleteKeyCode={['Backspace', 'Delete']}
          fitView
          fitViewOptions={{ padding: 0.28 }}
          minZoom={0.05}
          maxZoom={1.8}
          defaultViewport={{ x: 0, y: 0, zoom: 0.55 }}
          nodesDraggable
          nodesConnectable
          elementsSelectable
          panOnDrag
          selectionOnDrag
          defaultEdgeOptions={{
            type: 'smoothstep',
            markerEnd: {
              type: MarkerType.ArrowClosed
            }
          }}
          proOptions={{ hideAttribution: true }}
        >
          <Panel position="top-right">
            <div className="flex items-center gap-2 rounded-md border border-white/70 bg-white/85 px-3 py-1.5 text-[10px] font-black uppercase text-slate-500 shadow-sm backdrop-blur">
              Arraste, conecte e monte o fluxo
            </div>
          </Panel>

          <Panel position="bottom-left">
            <button
              onClick={() => onQuickAdd(null)}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-3 text-[11px] font-black uppercase text-white shadow-[0_18px_40px_rgba(51,92,255,0.28)] transition-all hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              Novo bloco
            </button>
          </Panel>

          <MiniMap
            zoomable
            pannable
            maskColor="rgba(15,23,42,0.08)"
            nodeColor={(node) => (node.id === selectedNodeId ? '#335cff' : '#dbe5ff')}
            className="!rounded-lg !border !border-white/80 !bg-white/90"
          />
          <Controls className="!rounded-lg !border !border-white/80 !bg-white/90 !shadow-sm" />
          <Background
            variant={BackgroundVariant.Dots}
            gap={22}
            size={1.4}
            color="#d8deeb"
          />
        </ReactFlow>

        {insertMenu?.isOpen && (
          <div className="pointer-events-none absolute bottom-6 right-6 top-6 z-20 flex items-start justify-end">
            <div className="pointer-events-auto">
              <FlowBlockLibrary
                compact
                title="O que voce quer adicionar?"
                groups={libraryGroups}
                onAddBlock={onChooseInsertType}
                onClose={onCloseInsertMenu}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function FlowCanvas(props) {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
