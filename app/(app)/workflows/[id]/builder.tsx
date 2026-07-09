"use client";

import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  useReactFlow,
  addEdge,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type EdgeChange,
  MarkerType,
} from "@xyflow/react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { NodePalette } from "@/components/workflow/node-palette";
import { WorkflowNode as AgentflowNode } from "@/components/workflow/custom-node";
import { Inspector } from "@/components/workflow/inspector";
import { CopilotPanel } from "@/components/workflow/copilot-panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { workflows } from "@/lib/mock/data";
import { getNodeDef } from "@/lib/nodes";
import { scheduleExecution } from "@/lib/mock/engine";
import type { WorkflowNode, NodeStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const nodeTypes = { agentflow: AgentflowNode };

let idCounter = 1000;
const nextId = () => `n${idCounter++}`;

// Convert our domain nodes -> React Flow nodes
function toFlowNodes(nodes: WorkflowNode[]): Node[] {
  return nodes.map((n) => ({
    id: n.id,
    type: "agentflow",
    position: n.position,
    data: { ...n.data, __type: n.type },
  }));
}
function fromFlowNodes(nodes: Node[]): WorkflowNode[] {
  return nodes.map((n) => {
    const d = n.data as Record<string, any>;
    return {
      id: n.id,
      position: n.position,
      type: d.__type,
      data: {
        label: d.label as string,
        config: (d.config as Record<string, unknown>) ?? {},
        status: d.status as WorkflowNode["data"]["status"] | undefined,
        durationMs: d.durationMs as number | undefined,
        logs: d.logs as string[] | undefined,
        retries: d.retries as number | undefined,
      },
    };
  });
}

function BuilderInner() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const wf = useMemo(() => workflows.find((w) => w.id === params.id) ?? workflows[0], [params.id]);

  const initialNodes = useMemo(() => toFlowNodes(wf.nodes), [wf]);
  const initialEdges = useMemo<Edge[]>(
    () =>
      wf.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        animated: e.animated,
        style: { stroke: "#3a3f52", strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#3a3f52" },
      })),
    [wf]
  );

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState(initialNodes);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(true);
  const [runLog, setRunLog] = useState<string[]>([]);
  const [paused, setPaused] = useState(false);

  // history for undo/redo
  const undoStack = useRef<Node[][]>([]);
  const redoStack = useRef<Node[][]>([]);
  const clipboard = useRef<Node[]>([]);
  const runTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const { screenToFlowPosition, fitView, getNode, getNodes } = useReactFlow();

  const selectedNode = useMemo<WorkflowNode | null>(() => {
    if (!selectedId) return null;
    const n = rfNodes.find((x) => x.id === selectedId);
    return n ? fromFlowNodes([n])[0] : null;
  }, [selectedId, rfNodes]);

  const snapshot = useCallback(() => {
    undoStack.current.push(JSON.parse(JSON.stringify(rfNodes)));
    if (undoStack.current.length > 50) undoStack.current.shift();
    redoStack.current = [];
  }, [rfNodes]);

  const onConnect = useCallback(
    (c: Connection | Edge) => {
      snapshot();
      setRfEdges((eds) =>
        addEdge(
          { ...c, animated: true, style: { stroke: "#3a3f52", strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: "#3a3f52" } } as any,
          eds
        )
      );
    },
    [setRfEdges, snapshot]
  );

  // drag & drop from palette
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData("application/agentflow-node");
      if (!type) return;
      const def = getNodeDef(type);
      if (!def) return;
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      snapshot();
      const newNode: Node = {
        id: nextId(),
        type: "agentflow",
        position,
        data: { label: def.label, config: { ...def.defaultConfig, __type: type }, status: "idle" },
      };
      setRfNodes((nds) => [...nds, newNode]);
    },
    [screenToFlowPosition, setRfNodes, snapshot]
  );
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  // selection + node changes (track selection)
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);
      for (const c of changes) {
        if (c.type === "select" && c.selected) setSelectedId(c.id);
      }
    },
    [onNodesChange]
  );

  const updateNode = useCallback(
    (id: string, patch: Partial<WorkflowNode["data"]>) => {
      setRfNodes((nds) =>
        nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n))
      );
    },
    [setRfNodes]
  );

  const onRename = useCallback((id: string, label: string) => {
    snapshot();
    updateNode(id, { label });
  }, [updateNode, snapshot]);

  // ---- Execution simulation ----
  const clearTimers = () => {
    runTimers.current.forEach(clearTimeout);
    runTimers.current = [];
  };
  const stopRun = () => {
    clearTimers();
    setRunning(false);
    setRfNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, status: "skipped" as NodeStatus } })));
    setRunLog((l) => [...l, "› execution stopped"]);
  };

  const runWorkflow = useCallback(() => {
    if (running) {
      stopRun();
      return;
    }
    const domainNodes = fromFlowNodes(getNodes());
    const domainEdges = rfEdges.map((e) => ({ id: e.id, source: e.source, target: e.target, animated: !!e.animated }));
    const { events, totalMs } = scheduleExecution(domainNodes, domainEdges);
    setRunning(true);
    setRunLog([`› starting execution · ${domainNodes.length} nodes · est ${Math.round(totalMs / 1000)}s`]);
    // reset statuses
    setRfNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, status: "idle" as NodeStatus, logs: [], durationMs: undefined, retries: 0 } })));
    const SPEED = 0.18; // replay 5.5x faster than simulated
    const nodeLogs: Record<string, string[]> = {};
    events.forEach((ev) => {
      const t = setTimeout(() => {
        const { event } = ev;
        if (event.status === "running" && !event.log && !event.reasoning) {
          // start: clear logs
          nodeLogs[event.nodeId] = [];
          updateNode(event.nodeId, { status: "running", logs: [], retries: event.attempt });
        } else if (event.log) {
          const logs = [...(nodeLogs[event.nodeId] ?? []), event.log];
          nodeLogs[event.nodeId] = logs;
          updateNode(event.nodeId, { status: event.status as NodeStatus, logs });
          setRunLog((l) => [...l, `[${event.nodeId}] ${event.log}`]);
        } else if (event.reasoning) {
          // reasoning ticks — keep running status
          updateNode(event.nodeId, { status: "running" });
          setRunLog((l) => [...l, `[${event.nodeId}] reasoning: ${event.reasoning}`]);
        } else if (event.status === "retrying") {
          nodeLogs[event.nodeId] = [...(nodeLogs[event.nodeId] ?? []), event.log ?? "retrying"];
          updateNode(event.nodeId, { status: "retrying", logs: nodeLogs[event.nodeId], retries: event.attempt });
          setRunLog((l) => [...l, `[${event.nodeId}] ${event.log}`]);
        }
      }, ev.at * SPEED);
      runTimers.current.push(t);
    });
    const done = setTimeout(() => {
      setRunning(false);
      setRunLog((l) => [...l, "✓ execution complete"]);
    }, (totalMs + 200) * SPEED);
    runTimers.current.push(done);
  }, [running, getNodes, rfEdges, setRfNodes, updateNode]);

  // retry a single node
  const onRetry = useCallback(
    (id: string) => {
      updateNode(id, { status: "running", logs: ["retry triggered"], retries: (selectedNode?.data.retries ?? 0) + 1 });
      const t = setTimeout(() => updateNode(id, { status: "succeeded", logs: ["Completed"], durationMs: 800 }), 900);
      runTimers.current.push(t);
    },
    [updateNode, selectedNode]
  );

  // ---- keyboard shortcuts ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          const next = redoStack.current.pop();
          if (next) {
            undoStack.current.push(JSON.parse(JSON.stringify(rfNodes)));
            setRfNodes(next);
          }
        } else {
          const prev = undoStack.current.pop();
          if (prev) {
            redoStack.current.push(JSON.parse(JSON.stringify(rfNodes)));
            setRfNodes(prev);
          }
        }
      } else if (meta && e.key.toLowerCase() === "y") {
        e.preventDefault();
        const next = redoStack.current.pop();
        if (next) {
          undoStack.current.push(JSON.parse(JSON.stringify(rfNodes)));
          setRfNodes(next);
        }
      } else if (meta && e.key.toLowerCase() === "c") {
        const sel = rfNodes.filter((n) => n.selected);
        if (sel.length) clipboard.current = JSON.parse(JSON.stringify(sel));
      } else if (meta && e.key.toLowerCase() === "v") {
        if (clipboard.current.length) {
          snapshot();
          const pasted = clipboard.current.map((n) => ({
            ...n,
            id: nextId(),
            position: { x: n.position.x + 40, y: n.position.y + 40 },
            selected: false,
            data: { ...n.data, status: "idle", logs: [], durationMs: undefined, retries: 0 },
          }));
          setRfNodes((nds) => [...nds, ...pasted]);
        }
      } else if (e.key === "Delete" || e.key === "Backspace") {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
        const sel = rfNodes.filter((n) => n.selected);
        if (sel.length) {
          snapshot();
          const ids = new Set(sel.map((n) => n.id));
          setRfNodes((nds) => nds.filter((n) => !ids.has(n.id)));
          setRfEdges((eds) => eds.filter((e) => !ids.has(e.source) && !ids.has(e.target)));
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rfNodes, rfEdges, setRfNodes, setRfEdges, snapshot]);

  // auto layout — column layout by topological order
  const autoLayout = useCallback(() => {
    snapshot();
    const nodes = getNodes();
    const edges = rfEdges;
    const indeg = new Map<string, number>();
    nodes.forEach((n) => indeg.set(n.id, 0));
    edges.forEach((e) => indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1));
    const levels = new Map<string, number>();
    const visit = (id: string, lvl: number) => {
      levels.set(id, Math.max(levels.get(id) ?? 0, lvl));
      edges.filter((e) => e.source === id).forEach((e) => visit(e.target, lvl + 1));
    };
    nodes.filter((n) => (indeg.get(n.id) ?? 0) === 0).forEach((n) => visit(n.id, 0));
    nodes.forEach((n) => levels.set(n.id, levels.get(n.id) ?? 0));
    const byLevel = new Map<number, Node[]>();
    nodes.forEach((n) => {
      const l = levels.get(n.id)!;
      if (!byLevel.has(l)) byLevel.set(l, []);
      byLevel.get(l)!.push(n);
    });
    const positioned = nodes.map((n) => {
      const l = levels.get(n.id)!;
      const col = byLevel.get(l)!;
      const idx = col.indexOf(n);
      return { ...n, position: { x: 60 + l * 300, y: 60 + idx * 160 } };
    });
    setRfNodes(positioned);
    setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 50);
  }, [getNodes, rfEdges, setRfNodes, fitView, snapshot]);

  // NL generation injection
  const handleGenerate = useCallback(
    (gen: { nodes: WorkflowNode[]; edges: { id: string; source: string; target: string }[] }) => {
      snapshot();
      const flowNodes: Node[] = gen.nodes.map((n) => ({
        id: n.id,
        type: "agentflow",
        position: n.position,
        data: { label: n.data.label, config: { ...n.data.config, __type: n.type }, status: "idle" as NodeStatus },
      }));
      const flowEdges: Edge[] = gen.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        animated: true,
        style: { stroke: "#7c5cff", strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#7c5cff" },
      }));
      setRfNodes(flowNodes);
      setRfEdges(flowEdges);
      setTimeout(() => fitView({ padding: 0.2, duration: 500 }), 80);
    },
    [setRfNodes, setRfEdges, fitView, snapshot]
  );

  useEffect(() => () => clearTimers(), []);

  const nodeCount = rfNodes.length;
  const succeededCount = rfNodes.filter((n) => n.data.status === "succeeded").length;
  const failedCount = rfNodes.filter((n) => n.data.status === "failed").length;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] -m-4 lg:-m-8">
      {/* Left palette */}
      <div className="hidden md:flex w-64 shrink-0 border-r border-border bg-bg-soft/60">
        <NodePalette />
      </div>

      {/* Center canvas */}
      <div className="relative flex-1 min-w-0">
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onNodeClick={(_, n) => setSelectedId(n.id)}
          onPaneClick={() => setSelectedId(null)}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          snapToGrid
          snapGrid={[16, 16]}
          defaultEdgeOptions={{ style: { stroke: "#3a3f52", strokeWidth: 2 } }}
          proOptions={{ hideAttribution: true }}
          className="bg-bg"
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#1f2330" />
          <Controls className="border! border-border! rounded-lg! overflow-hidden!" />
          <MiniMap
            pannable
            zoomable
            nodeColor={(n) => getNodeDef((n.data as any).__type)?.color ?? "#3a3f52"}
            className="border! border-border! rounded-lg!"
            maskColor="rgba(7,8,12,0.7)"
          />

          {/* Top toolbar */}
          <Panel position="top-left">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-2/90 backdrop-blur-xl px-2.5 py-1.5 shadow-lg">
              <button onClick={() => router.back()} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-surface-3 text-fg-muted hover:text-fg">
                <Icon name="ArrowLeft" className="h-4 w-4" />
              </button>
              <div className="h-5 w-px bg-border" />
              <button title="Undo (⌘Z)" onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "z", metaKey: true }))} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-surface-3 text-fg-muted hover:text-fg">
                <Icon name="Undo2" className="h-4 w-4" />
              </button>
              <button title="Redo (⌘⇧Z)" onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "z", metaKey: true, shiftKey: true }))} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-surface-3 text-fg-muted hover:text-fg">
                <Icon name="Redo2" className="h-4 w-4" />
              </button>
              <div className="h-5 w-px bg-border" />
              <button title="Auto layout" onClick={autoLayout} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-surface-3 text-fg-muted hover:text-fg">
                <Icon name="LayoutGrid" className="h-4 w-4" />
              </button>
              <button title="Fit view" onClick={() => fitView({ padding: 0.2, duration: 300 })} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-surface-3 text-fg-muted hover:text-fg">
                <Icon name="Maximize" className="h-4 w-4" />
              </button>
            </div>
          </Panel>

          {/* Header strip */}
          <Panel position="top-center">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-2/90 backdrop-blur-xl px-3 py-1.5 shadow-lg">
              <Icon name="Workflow" className="h-4 w-4 text-brand" />
              <span className="text-sm font-semibold">{wf.name}</span>
              <Badge tone={wf.status === "active" ? "success" : wf.status === "error" ? "danger" : wf.status === "paused" ? "warning" : "neutral"}>
                {wf.status}
              </Badge>
              <span className="text-[11px] text-fg-subtle">v{wf.version} · {nodeCount} nodes</span>
            </div>
          </Panel>

          {/* Run control */}
          <Panel position="top-right">
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setCopilotOpen((o) => !o)}>
                <Icon name="Sparkles" className="h-3.5 w-3.5" /> Copilot
              </Button>
              <Button
                size="sm"
                variant={running ? "danger" : "ai"}
                onClick={runWorkflow}
                className="min-w-[96px]"
              >
                {running ? (
                  <><Icon name="Square" className="h-3.5 w-3.5" /> Stop</>
                ) : (
                  <><Icon name="Play" className="h-3.5 w-3.5" /> Run</>
                )}
              </Button>
            </div>
          </Panel>

          {/* Bottom live log */}
          <Panel position="bottom-left">
            <div className="w-[28rem] max-w-[80vw] rounded-xl border border-border bg-bg/90 backdrop-blur-xl shadow-lg overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border text-[11px] text-fg-subtle">
                <Icon name="Terminal" className="h-3 w-3" /> execution log
                {running && <span className="ml-auto flex items-center gap-1 text-brand"><Icon name="LoaderCircle" className="h-3 w-3 animate-spin" /> running</span>}
                {!running && runLog.length > 0 && <span className="ml-auto text-fg-subtle">{succeededCount} ok · {failedCount} failed</span>}
              </div>
              <div className="max-h-28 overflow-y-auto px-3 py-2 font-mono text-[10px] leading-relaxed">
                {runLog.length === 0 ? (
                  <div className="text-fg-subtle">Press Run to execute. Logs stream in real time.</div>
                ) : (
                  runLog.slice(-40).map((l, i) => (
                    <div key={i} className={cn("py-0.5", l.startsWith("✓") && "text-success", l.startsWith("›") && "text-fg-muted")}>
                      {l}
                    </div>
                  ))
                )}
              </div>
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {/* Right inspector / copilot */}
      <div className="hidden lg:flex w-80 shrink-0 border-l border-border bg-bg-soft/60 relative">
        <AnimatePresence mode="wait">
          {copilotOpen ? (
            <motion.div key="copilot" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0">
              <CopilotPanel workflowName={wf.name} nodeCount={nodeCount} onGenerate={handleGenerate} onInspect={() => setCopilotOpen(false)} />
            </motion.div>
          ) : (
            <motion.div key="inspector" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0">
              <div className="flex items-center justify-between border-b border-border p-2">
                <button onClick={() => setCopilotOpen(true)} className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-fg-muted hover:bg-surface-2 hover:text-fg">
                  <Icon name="ArrowLeft" className="h-3.5 w-3.5" /> Copilot
                </button>
                <span className="text-[10px] text-fg-subtle">Inspector</span>
              </div>
              <Inspector node={selectedNode} onRename={onRename} onRetry={onRetry} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function Builder() {
  return (
    <ReactFlowProvider>
      <BuilderInner />
    </ReactFlowProvider>
  );
}