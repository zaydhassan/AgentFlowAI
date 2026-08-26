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
  useNodesState,
  useEdgesState,
  useReactFlow,
  addEdge,
  MarkerType,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type OnNodesChange,
} from "@xyflow/react";
import { motion, AnimatePresence } from "framer-motion";
import { NodePalette } from "@/components/workflow/node-palette";
import { WorkflowNode as AgentflowNode } from "@/components/workflow/custom-node";
import { StickyNote } from "@/components/workflow/sticky-note";
import { Comment } from "@/components/workflow/comment";
import { GroupNode } from "@/components/workflow/group-node";
import { CustomEdge } from "@/components/workflow/custom-edge";
import { Inspector } from "@/components/workflow/inspector";
import { CopilotPanel } from "@/components/workflow/copilot-panel";
import { ExecutionDock, type DockStep, type DockStatus, type DockTotals, type DockMemory } from "@/components/workflow/execution-dock";
import { VersionHistory, type VersionEntry } from "@/components/workflow/version-history";
import { VersionCompareModal } from "@/components/workflow/version-compare-modal";
import { CostOptimizer } from "@/components/workflow/cost-optimizer";
import { SimulationModal } from "@/components/workflow/simulation-modal";
import { NodeSearch } from "@/components/workflow/node-search";
import { ContextMenu, type ContextAction } from "@/components/workflow/context-menu";
import { Button } from "@/components/ui/button";
import { Badge, type Tone } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { getNodeDef } from "@/lib/nodes";
import { cn } from "@/lib/utils";
import { streamSSE } from "@/lib/workflow/sse-client";
import { useDropdown } from "@/lib/hooks/use-dropdown";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import type { Graph } from "@/lib/workflow/graph";
import type { WorkflowNode, WorkflowEdge, NodeStatus } from "@/lib/types";

const nodeTypes = { agentflow: AgentflowNode, sticky: StickyNote, comment: Comment, group: GroupNode };
const edgeTypes = { custom: CustomEdge };

const CANVAS_TYPES = new Set(["sticky", "comment", "group"]);

let idCounter = 1000;
const nextId = () => `n${idCounter++}`;

export interface InitialWorkflow {
  id: string;
  name: string;
  description: string;
  status: string;
  version: number;
  graph: Graph;
  versions: VersionEntry[];
  /** Present when the workflow was created from a marketplace template — drives the empty-state copy. */
  templateOrigin?: { name: string; description: string };
}

function toFlowNodes(nodes: WorkflowNode[]): Node[] {
  return nodes.map((n) => {
    if (CANVAS_TYPES.has(n.type)) {
      return { id: n.id, type: n.type, position: n.position, data: { ...n.data }, width: n.type === "group" ? 320 : undefined, height: n.type === "group" ? 200 : undefined };
    }
    return { id: n.id, type: "agentflow", position: n.position, data: { ...n.data, __type: n.type } };
  });
}
function fromFlowNodes(nodes: Node[]): WorkflowNode[] {
  return nodes.map((n) => {
    const d = n.data as Record<string, unknown>;
    if (CANVAS_TYPES.has(n.type ?? "")) {
      return { id: n.id, position: n.position, type: n.type as string, data: d as WorkflowNode["data"] };
    }
    return {
      id: n.id,
      position: n.position,
      type: (d.__type as string) ?? "util.delay",
      data: {
        label: (d.label as string) ?? "",
        config: (d.config as Record<string, unknown>) ?? {},
        ...(d.status != null ? { status: d.status as NodeStatus } : {}),
        ...(d.durationMs != null ? { durationMs: d.durationMs as number } : {}),
        ...(d.tokensUsed != null ? { tokensUsed: d.tokensUsed as number } : {}),
        ...(d.logs != null ? { logs: d.logs as string[] } : {}),
        ...(d.retries != null ? { retries: d.retries as number } : {}),
        ...(d.breakpoint != null ? { breakpoint: d.breakpoint as boolean } : {}),
      },
    };
  });
}
function domainEdges(edges: Edge[]): WorkflowEdge[] {
  return edges.map((e) => ({ id: e.id, source: e.source, target: e.target, animated: !!e.animated, ...(e.label ? { label: String(e.label) } : {}) }));
}

const EDGE_STYLE = { stroke: "#5b6178", strokeWidth: 2 };
const EDGE_MARKER = { type: MarkerType.ArrowClosed, color: "#5b6178" };

interface Snapshot {
  nodes: Node[];
  edges: Edge[];
  viewport: { x: number; y: number; zoom: number };
}

function BuilderInner({ initial }: { initial: InitialWorkflow }) {
  const { id: workflowId, name: initialName, version: initialVersion, graph: initialGraph, versions: initialVersions, templateOrigin } = initial;

  const initialNodes = useMemo(() => toFlowNodes(initialGraph.nodes), [initialGraph]);
  const initialEdges = useMemo<Edge[]>(
    () => initialGraph.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, type: "custom", animated: e.animated, data: {}, style: EDGE_STYLE, markerEnd: EDGE_MARKER })),
    [initialGraph],
  );

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState(initialNodes);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copilotOpen, setCopilotOpen] = useState(true);
  const [name, setName] = useState(initialName);
  const [version, setVersion] = useState(initialVersion);
  const [versions, setVersions] = useState<VersionEntry[]>(initialVersions);
  const [saveState, setSaveState] = useState<"saved" | "saving">("saved");
  const [searchOpen, setSearchOpen] = useState(false);
  const [dockOpen, setDockOpen] = useState(false);
  const {
    open: versionMenuOpen,
    toggle: toggleVersionMenu,
    close: closeVersionMenu,
    panelRef: versionPanelRef,
    triggerRef: versionTriggerRef,
  } = useDropdown<HTMLButtonElement>("builder-version-menu");
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareFrom, setCompareFrom] = useState<number | undefined>(undefined);
  const [compareTo, setCompareTo] = useState<number | undefined>(undefined);
  const [optimizerOpen, setOptimizerOpen] = useState(false);
  const [simulateOpen, setSimulateOpen] = useState(false);
  const [simulateGraph, setSimulateGraph] = useState<Graph | null>(null);
  const [ctx, setCtx] = useState<{ x: number; y: number; nodeId: string | null } | null>(null);
  const [diagnoseSignal, setDiagnoseSignal] = useState(0);
  // Mobile drawer state. The inline panels are shown via CSS (md:/lg:); these
  // only open the slide-over drawers used below those breakpoints. Gated by
  // useMediaQuery on render so a desktop viewport can never mount a drawer
  // (avoids double-mounting CopilotPanel/NodePalette and their effects).
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(false);
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false);
  const isMdPlus = useMediaQuery("(min-width: 768px)");
  const isXlPlus = useMediaQuery("(min-width: 1280px)");

  const [runStatus, setRunStatus] = useState<DockStatus>("idle");
  const [runLog, setRunLog] = useState<string[]>([]);
  const [steps, setSteps] = useState<DockStep[]>([]);
  const [totals, setTotals] = useState<DockTotals | null>(null);
  const [replayingId, setReplayingId] = useState<string | null>(null);
  const [currentExecutionId, setCurrentExecutionId] = useState<string | null>(null);
  const executionId = useRef<string | null>(null);
  const sseHandle = useRef<{ abort: () => void } | null>(null);
  const replayHandle = useRef<{ abort: () => void } | null>(null);
  const stepsRef = useRef<Map<string, DockStep>>(new Map());

  const undoStack = useRef<Snapshot[]>([]);
  const redoStack = useRef<Snapshot[]>([]);
  const clipboard = useRef<Node[]>([]);

  const { screenToFlowPosition, fitView, getViewport, setViewport, getNode, getNodes } = useReactFlow();

  const selectedNode = useMemo<WorkflowNode | null>(() => {
    if (!selectedId) return null;
    const n = rfNodes.find((x) => x.id === selectedId);
    return n ? fromFlowNodes([n])[0] : null;
  }, [selectedId, rfNodes]);

  const graphForApi = useCallback((): Graph => {
    const vp = getViewport();
    return { nodes: fromFlowNodes(getNodes()), edges: domainEdges(rfEdges), viewport: { x: vp.x, y: vp.y, zoom: vp.zoom } };
  }, [getNodes, rfEdges, getViewport]);

  const snapshot = useCallback(() => {
    undoStack.current.push({ nodes: JSON.parse(JSON.stringify(rfNodes)), edges: JSON.parse(JSON.stringify(rfEdges)), viewport: getViewport() });
    if (undoStack.current.length > 50) undoStack.current.shift();
    redoStack.current = [];
  }, [rfNodes, rfEdges, getViewport]);

  const restore = useCallback((s: Snapshot) => {
    setRfNodes(s.nodes);
    setRfEdges(s.edges);
    setViewport(s.viewport);
  }, [setRfNodes, setRfEdges, setViewport]);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>("{}");
  useEffect(() => {
    const graph = graphForApi();
    const payload = { name, graph };
    const serialized = JSON.stringify({ graph: graph.nodes.length + graph.edges.length, name });
    if (serialized === lastSavedRef.current) return;
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await fetch(`/api/workflows/${workflowId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        lastSavedRef.current = serialized;
        setSaveState("saved");
      } catch {
        setSaveState("saved");
      }
    }, 800);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [rfNodes, rfEdges, name, workflowId, graphForApi]);

  const patchNode = useCallback((nodeId: string, patch: Record<string, unknown>) => {
    setRfNodes((nds) => nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n)));
  }, [setRfNodes]);

  const onUpdate = useCallback((nodeId: string, patch: Partial<WorkflowNode["data"]>) => { patchNode(nodeId, patch); }, [patchNode]);
  const toggleBreakpoint = useCallback((nodeId: string) => {
    const n = getNode(nodeId);
    patchNode(nodeId, { breakpoint: !((n?.data as { breakpoint?: boolean })?.breakpoint) });
  }, [getNode, patchNode]);
  const deleteNode = useCallback((nodeId: string) => {
    snapshot();
    setRfNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setRfEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setSelectedId(null);
  }, [snapshot, setRfNodes, setRfEdges]);

  const insertNode = useCallback((type: string, position?: { x: number; y: number }) => {
    snapshot();
    const pos = position ?? { x: 200 + Math.random() * 200, y: 150 + Math.random() * 200 };
    if (CANVAS_TYPES.has(type)) {
      const data: Record<string, unknown> =
        type === "sticky" ? { sticky: { content: "", color: "#facc15" } }
          : type === "comment" ? { comment: { content: "" } }
            : { group: { label: "Group", color: "#64748b" } };
      const node: Node = { id: nextId(), type, position: pos, data, ...(type === "group" ? { width: 320, height: 200 } : {}) };
      setRfNodes((nds) => [...nds, node]);
      return;
    }
    const def = getNodeDef(type);
    if (!def) return;
    const node: Node = { id: nextId(), type: "agentflow", position: pos, data: { label: def.label, config: { ...def.defaultConfig, __type: type }, status: "idle" } };
    setRfNodes((nds) => [...nds, node]);
  }, [snapshot, setRfNodes]);

  const duplicateSelected = useCallback(() => {
    const sel = rfNodes.filter((n) => n.selected);
    if (!sel.length) return;
    snapshot();
    const ids = new Set(sel.map((n) => n.id));
    const copies = sel.map((n) => ({ ...JSON.parse(JSON.stringify(n)), id: nextId(), position: { x: n.position.x + 40, y: n.position.y + 40 }, selected: false }));
    setRfNodes((nds) => [...nds, ...copies]);
    const internal = rfEdges.filter((e) => ids.has(e.source) && ids.has(e.target));
    const idMap = new Map(sel.map((n, i) => [n.id, copies[i].id]));
    setRfEdges((eds) => [...eds, ...internal.map((e) => ({ ...JSON.parse(JSON.stringify(e)), id: `e${nextId()}`, source: idMap.get(e.source)!, target: idMap.get(e.target)! }))]);
  }, [rfNodes, rfEdges, snapshot, setRfNodes, setRfEdges]);

  const groupSelected = useCallback(() => {
    const sel = rfNodes.filter((n) => n.selected && !CANVAS_TYPES.has(n.type ?? ""));
    if (sel.length < 2) return;
    snapshot();
    const xs = sel.map((n) => n.position.x);
    const ys = sel.map((n) => n.position.y);
    const minX = Math.min(...xs), minY = Math.min(...ys);
    const groupId = nextId();
    const group: Node = { id: groupId, type: "group", position: { x: minX - 24, y: minY - 36 }, data: { group: { label: "Group", color: "#64748b" } }, width: 360, height: 240 };
    setRfNodes((nds) => {
      const without = nds.filter((n) => !sel.some((s) => s.id === n.id));
      const reparented = sel.map((n) => ({ ...n, parent: groupId, extent: "parent" as const, position: { x: n.position.x - minX + 24, y: n.position.y - minY + 36 }, selected: false }));
      return [...without, group, ...reparented];
    });
  }, [rfNodes, snapshot, setRfNodes]);

  const onConnect = useCallback((c: Connection | Edge) => {
    snapshot();
    setRfEdges((eds) => addEdge({ ...c, type: "custom", animated: true, data: {}, style: EDGE_STYLE, markerEnd: EDGE_MARKER } as Edge, eds));
  }, [setRfEdges, snapshot]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("application/agentflow-node");
    if (!type) return;
    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    insertNode(type, position);
  }, [screenToFlowPosition, insertNode]);
  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }, []);

  const handleNodesChange: OnNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChange(changes);
    for (const c of changes) if (c.type === "select" && c.selected) setSelectedId(c.id);
  }, [onNodesChange]);

  const resetNodeStatuses = useCallback(() => {
    setRfNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, status: "idle", logs: [], durationMs: undefined, tokensUsed: undefined, retries: 0 } })));
    setRfEdges((eds) => eds.map((e) => ({ ...e, data: { ...e.data, status: undefined } })));
  }, [setRfNodes, setRfEdges]);

  const stopRun = useCallback(() => {
    if (executionId.current) fetch(`/api/workflows/${workflowId}/run?control=stop&executionId=${executionId.current}`, { method: "POST" });
    sseHandle.current?.abort();
    setRunStatus("cancelled");
    setRunLog((l) => [...l, "› execution stopped"]);
  }, [workflowId]);

  const runWorkflow = useCallback(() => {
    if (runStatus === "running") { stopRun(); return; }
    sseHandle.current?.abort();
    stepsRef.current.clear();
    setSteps([]);
    setRunLog([]);
    setTotals(null);
    setReplayingId(null);
    setCurrentExecutionId(null);
    setRunStatus("running");
    resetNodeStatuses();
    setDockOpen(true);

    const graph = graphForApi();
    const breakpoints = getNodes().filter((n) => (n.data as { breakpoint?: boolean }).breakpoint).map((n) => n.id);

    sseHandle.current = streamSSE(`/api/workflows/${workflowId}/run`, { graph, breakpoints }, {
      onMessage: (data) => {
        const ev = data as { type: string; nodeId?: string; nodeName?: string; status?: string; log?: string; reasoning?: string; attempt?: number; durationMs?: number; tokensUsed?: number; cost?: number; retries?: number; error?: string; nodeType?: string; config?: unknown; input?: unknown; output?: unknown; prompt?: { system: string; user: string }; memories?: DockMemory[]; totals?: { status: string; durationMs: number; totalTokens: number; totalCost: number; retried: number; error?: string }; executionId?: string };
        switch (ev.type) {
          case "execution":
            executionId.current = ev.executionId ?? null;
            setCurrentExecutionId(ev.executionId ?? null);
            setRunLog((l) => [...l, `› starting execution · ${graph.nodes.length} nodes`]);
            break;
          case "node:start":
            stepsRef.current.set(ev.nodeId!, { nodeId: ev.nodeId!, nodeName: ev.nodeName ?? ev.nodeId!, status: "running", durationMs: 0, tokensUsed: 0, cost: 0, retries: 0, logs: [] });
            setSteps(Array.from(stepsRef.current.values()));
            patchNode(ev.nodeId!, { status: "running", logs: [], retries: ev.attempt ?? 0 });
            break;
          case "node:log": {
            const s = stepsRef.current.get(ev.nodeId!);
            if (s) { s.logs.push(ev.log!); setSteps(Array.from(stepsRef.current.values())); }
            const n = getNode(ev.nodeId!);
            patchNode(ev.nodeId!, { status: (ev.status as NodeStatus) ?? "running", logs: [...((n?.data as { logs?: string[] })?.logs ?? []), ev.log!] });
            setRunLog((l) => [...l, `[${ev.nodeName ?? ev.nodeId}] ${ev.log}`]);
            break;
          }
          case "node:reasoning": {
            const s = stepsRef.current.get(ev.nodeId!);
            if (s) { s.logs.push(`reasoning: ${ev.reasoning}`); setSteps(Array.from(stepsRef.current.values())); }
            setRunLog((l) => [...l, `[${ev.nodeName ?? ev.nodeId}] reasoning: ${ev.reasoning}`]);
            break;
          }
          case "node:retry":
            stepsRef.current.set(ev.nodeId!, { ...(stepsRef.current.get(ev.nodeId!) ?? { nodeId: ev.nodeId!, nodeName: ev.nodeName ?? ev.nodeId!, durationMs: 0, tokensUsed: 0, cost: 0, logs: [], retries: 0, status: "retrying" }), status: "retrying", retries: ev.attempt ?? 0 });
            setSteps(Array.from(stepsRef.current.values()));
            patchNode(ev.nodeId!, { status: "retrying", retries: ev.attempt ?? 0 });
            break;
          case "node:success":
            stepsRef.current.set(ev.nodeId!, { ...(stepsRef.current.get(ev.nodeId!)!), status: "succeeded", durationMs: ev.durationMs ?? 0, tokensUsed: ev.tokensUsed ?? 0, cost: ev.cost ?? 0, retries: ev.retries ?? 0, nodeType: ev.nodeType, config: ev.config, input: ev.input, output: ev.output, prompt: ev.prompt, memories: ev.memories });
            setSteps(Array.from(stepsRef.current.values()));
            patchNode(ev.nodeId!, { status: "succeeded", durationMs: ev.durationMs, tokensUsed: ev.tokensUsed });
            setRfEdges((eds) => eds.map((e) => (e.source === ev.nodeId ? { ...e, animated: false, data: { ...e.data, status: "succeeded" } } : e)));
            break;
          case "node:fail":
            stepsRef.current.set(ev.nodeId!, { ...(stepsRef.current.get(ev.nodeId!)!), status: "failed", durationMs: ev.durationMs ?? 0, tokensUsed: ev.tokensUsed ?? 0, cost: ev.cost ?? 0, retries: ev.retries ?? 0, error: ev.error, nodeType: ev.nodeType, config: ev.config, input: ev.input, output: ev.output, prompt: ev.prompt, memories: ev.memories });
            setSteps(Array.from(stepsRef.current.values()));
            patchNode(ev.nodeId!, { status: "failed", durationMs: ev.durationMs, error: ev.error, logs: [...((getNode(ev.nodeId!)?.data as { logs?: string[] })?.logs ?? []), ev.error ?? "failed"] });
            setRfEdges((eds) => eds.map((e) => (e.source === ev.nodeId ? { ...e, animated: false, data: { ...e.data, status: "failed" } } : e)));
            setRunLog((l) => [...l, `[${ev.nodeName}] ✗ ${ev.error ?? "failed"}`]);
            break;
          case "node:paused":
            setRunStatus("paused");
            patchNode(ev.nodeId!, { status: "running" });
            setRunLog((l) => [...l, `[${ev.nodeName}] paused at breakpoint`]);
            break;
          case "complete": {
            const status = (ev.totals?.status as DockStatus) ?? "succeeded";
            setRunStatus(status);
            if (ev.totals) setTotals({ durationMs: ev.totals.durationMs, totalTokens: ev.totals.totalTokens, totalCost: ev.totals.totalCost, retried: ev.totals.retried, status: ev.totals.status as DockTotals["status"], ...(ev.totals.error ? { error: ev.totals.error } : {}) });
            setRunLog((l) => [...l, status === "succeeded" ? "✓ execution complete" : status === "failed" ? "✗ execution failed" : "› execution stopped"]);
            setVersion((v) => v); // unchanged; run doesn't bump version
            break;
          }
        }
      },
      onError: (err) => { setRunLog((l) => [...l, `✗ stream error: ${err.message}`]); setRunStatus("failed"); },
      onClose: () => { executionId.current = null; },
    });
  }, [runStatus, workflowId, graphForApi, getNodes, resetNodeStatuses, patchNode, getNode, setRfEdges, stopRun]);

  const resumeRun = useCallback(() => {
    if (executionId.current) fetch(`/api/workflows/${workflowId}/run?control=resume&executionId=${executionId.current}`, { method: "POST" });
    setRunStatus("running");
  }, [workflowId]);

  const retryNode = useCallback((nodeId: string) => {
    patchNode(nodeId, { status: "running", logs: ["retry triggered"], retries: ((getNode(nodeId)?.data as { retries?: number })?.retries ?? 0) + 1 });
    setTimeout(() => patchNode(nodeId, { status: "succeeded", logs: ["Completed"], durationMs: 800 }), 900);
  }, [patchNode, getNode]);

  const stepRunCb = useCallback(() => {
    if (executionId.current) fetch(`/api/workflows/${workflowId}/run?control=step&executionId=${executionId.current}`, { method: "POST" });
    setRunStatus("running");
  }, [workflowId]);

  const pauseRunCb = useCallback(() => {
    if (executionId.current) fetch(`/api/workflows/${workflowId}/run?control=pause&executionId=${executionId.current}`, { method: "POST" });
  }, [workflowId]);

  // Streams the replay endpoint and updates the step's inspection payload +
  // status in place, so the Debug tab shows the new I/O live.
  const replayNode = useCallback((nodeId: string) => {
    const eid = currentExecutionId;
    if (!eid) return;
    replayHandle.current?.abort();
    setReplayingId(nodeId);
    replayHandle.current = streamSSE(`/api/workflows/${workflowId}/executions/${eid}/nodes/${nodeId}/replay`, {}, {
      onMessage: (data) => {
        const ev = data as { type: string; nodeId?: string; nodeName?: string; status?: string; log?: string; durationMs?: number; tokensUsed?: number; cost?: number; retries?: number; error?: string; nodeType?: string; config?: unknown; input?: unknown; output?: unknown; prompt?: { system: string; user: string }; memories?: DockMemory[] };
        const prev = stepsRef.current.get(nodeId);
        switch (ev.type) {
          case "node:start":
            stepsRef.current.set(nodeId, { nodeId, nodeName: prev?.nodeName ?? ev.nodeName ?? nodeId, status: "running", durationMs: 0, tokensUsed: 0, cost: 0, retries: 0, logs: [], nodeType: ev.nodeType });
            setSteps(Array.from(stepsRef.current.values()));
            break;
          case "node:log": {
            const s = stepsRef.current.get(nodeId);
            if (s) { s.logs.push(ev.log!); setSteps(Array.from(stepsRef.current.values())); }
            break;
          }
          case "node:success":
            stepsRef.current.set(nodeId, { ...(stepsRef.current.get(nodeId)!), status: "succeeded", durationMs: ev.durationMs ?? 0, tokensUsed: ev.tokensUsed ?? 0, cost: ev.cost ?? 0, retries: ev.retries ?? 0, nodeType: ev.nodeType, config: ev.config, input: ev.input, output: ev.output, prompt: ev.prompt, memories: ev.memories, logs: [...(stepsRef.current.get(nodeId)?.logs ?? []), "Completed"] });
            setSteps(Array.from(stepsRef.current.values()));
            break;
          case "node:fail":
            stepsRef.current.set(nodeId, { ...(stepsRef.current.get(nodeId)!), status: "failed", durationMs: ev.durationMs ?? 0, tokensUsed: ev.tokensUsed ?? 0, cost: ev.cost ?? 0, retries: ev.retries ?? 0, error: ev.error, nodeType: ev.nodeType, config: ev.config, input: ev.input, output: ev.output, prompt: ev.prompt, memories: ev.memories, logs: [...(stepsRef.current.get(nodeId)?.logs ?? []), ev.error ?? "failed"] });
            setSteps(Array.from(stepsRef.current.values()));
            break;
        }
      },
      onClose: () => setReplayingId(null),
    });
  }, [workflowId, currentExecutionId]);

  const handleGenerate = useCallback((gen: { nodes: WorkflowNode[]; edges: { id: string; source: string; target: string }[] }) => {
    snapshot();
    setRfNodes(toFlowNodes(gen.nodes));
    setRfEdges(gen.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, type: "custom", animated: true, data: {}, style: { stroke: "#7c5cff", strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: "#7c5cff" } })));
    setTimeout(() => fitView({ padding: 0.2, duration: 500 }), 80);
  }, [snapshot, setRfNodes, setRfEdges, fitView]);

  const saveVersion = useCallback(() => {
    const message = window.prompt("Version message (optional):", `v${version + 1}`);
    if (message === null) return;
    setSaveState("saving");
    fetch(`/api/workflows/${workflowId}/versions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ graph: graphForApi(), message: message || undefined }) })
      .then((r) => r.json())
      .then((v: VersionEntry) => { setVersion(v.version); setVersions((vs) => [v, ...vs.filter((x) => x.id !== v.id)]); setSaveState("saved"); })
      .catch(() => setSaveState("saved"));
  }, [workflowId, version, graphForApi]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement;
      const inField = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

      if (e.key === "/" && !inField) { e.preventDefault(); setSearchOpen(true); return; }
      if (meta && e.key.toLowerCase() === "k") { e.preventDefault(); setSearchOpen(true); return; }

      if (meta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        const snap: Snapshot = { nodes: JSON.parse(JSON.stringify(rfNodes)), edges: JSON.parse(JSON.stringify(rfEdges)), viewport: getViewport() };
        if (e.shiftKey) { const next = redoStack.current.pop(); if (next) { undoStack.current.push(snap); restore(next); } }
        else { const prev = undoStack.current.pop(); if (prev) { redoStack.current.push(snap); restore(prev); } }
      } else if (meta && e.key.toLowerCase() === "y") {
        e.preventDefault();
        const snap: Snapshot = { nodes: JSON.parse(JSON.stringify(rfNodes)), edges: JSON.parse(JSON.stringify(rfEdges)), viewport: getViewport() };
        const next = redoStack.current.pop(); if (next) { undoStack.current.push(snap); restore(next); }
      } else if (meta && e.key.toLowerCase() === "c" && !inField) {
        const sel = rfNodes.filter((n) => n.selected); if (sel.length) clipboard.current = JSON.parse(JSON.stringify(sel));
      } else if (meta && e.key.toLowerCase() === "v" && !inField) {
        if (clipboard.current.length) {
          snapshot();
          const pasted = clipboard.current.map((n) => ({ ...n, id: nextId(), position: { x: n.position.x + 40, y: n.position.y + 40 }, selected: false, data: { ...n.data, status: "idle", logs: [], durationMs: undefined, retries: 0 } }));
          setRfNodes((nds) => [...nds, ...pasted]);
        }
      } else if (meta && e.key.toLowerCase() === "d" && !inField) {
        e.preventDefault(); duplicateSelected();
      } else if (meta && e.key.toLowerCase() === "g" && !inField) {
        e.preventDefault(); groupSelected();
      } else if (meta && e.key.toLowerCase() === "s") {
        e.preventDefault(); saveVersion();
      } else if (meta && e.key === "Enter") {
        e.preventDefault(); runWorkflow();
      } else if ((e.key === "f" || e.key === "F") && !inField && !meta) {
        e.preventDefault(); fitView({ padding: 0.2, duration: 300 });
      } else if ((e.key === "Delete" || e.key === "Backspace") && !inField) {
        const sel = rfNodes.filter((n) => n.selected);
        if (sel.length) {
          snapshot();
          const ids = new Set(sel.map((n) => n.id));
          setRfNodes((nds) => nds.filter((n) => !ids.has(n.id)));
          setRfEdges((eds) => eds.filter((ed) => !ids.has(ed.source) && !ids.has(ed.target)));
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rfNodes, rfEdges, getViewport, restore, snapshot, setRfNodes, setRfEdges, duplicateSelected, groupSelected, fitView, runWorkflow, saveVersion]);

  const restoreVersion = useCallback((g: Graph) => {
    snapshot();
    setRfNodes(toFlowNodes(g.nodes));
    setRfEdges(g.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, type: "custom", animated: e.animated, data: {}, style: EDGE_STYLE, markerEnd: EDGE_MARKER })));
    setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 50);
  }, [snapshot, setRfNodes, setRfEdges, fitView]);

  const openCompare = useCallback((from?: number, to?: number) => {
    setCompareFrom(from);
    setCompareTo(to);
    setCompareOpen(true);
  }, []);

  const onPaneContextMenu = useCallback((e: MouseEvent | React.MouseEvent) => {
    e.preventDefault();
    setCtx({ x: e.clientX, y: e.clientY, nodeId: null });
  }, []);
  const onNodeContextMenu = useCallback((e: React.MouseEvent, node: Node) => {
    e.preventDefault();
    setSelectedId(node.id);
    setCtx({ x: e.clientX, y: e.clientY, nodeId: node.id });
  }, []);

  const ctxActions = useMemo<ContextAction[]>(() => {
    if (!ctx) return [];
    const id = ctx.nodeId;
    if (id) {
      const n = getNode(id);
      const isCanvas = CANVAS_TYPES.has(n?.type ?? "");
      return [
        { key: "dup", label: "Duplicate (⌘D)", icon: "Copy", onClick: () => duplicateSelected() },
        { key: "copy", label: "Copy (⌘C)", icon: "ClipboardCopy", onClick: () => { const sel = rfNodes.filter((x) => x.selected); if (sel.length) clipboard.current = JSON.parse(JSON.stringify(sel)); } },
        { key: "brk", label: "Toggle breakpoint", icon: "CircleDot", onClick: () => toggleBreakpoint(id) },
        ...(isCanvas ? [] : [{ key: "retry", label: "Run from here", icon: "Play", onClick: () => retryNode(id) }]),
        { key: "d1", label: "", icon: "Minus", onClick: () => {}, divider: true },
        { key: "del", label: "Delete (⌫)", icon: "Trash2", danger: true, onClick: () => deleteNode(id) },
      ];
    }
    return [
      { key: "sticky", label: "Add sticky note", icon: "StickyNote", onClick: () => insertNode("sticky") },
      { key: "comment", label: "Add comment", icon: "MessageCircle", onClick: () => insertNode("comment") },
      { key: "group", label: "Add group", icon: "SquareStack", onClick: () => insertNode("group") },
      { key: "d1", label: "", icon: "Minus", onClick: () => {}, divider: true },
      { key: "layout", label: "Auto layout", icon: "LayoutGrid", onClick: () => autoLayout() },
      { key: "fit", label: "Fit view (F)", icon: "Maximize", onClick: () => fitView({ padding: 0.2, duration: 300 }) },
    ];
  }, [ctx, getNode, duplicateSelected, rfNodes, toggleBreakpoint, retryNode, deleteNode, insertNode, fitView]);

  const autoLayout = useCallback(() => {
    snapshot();
    const nodes = getNodes().filter((n) => !CANVAS_TYPES.has(n.type ?? ""));
    const edges = rfEdges;
    const indeg = new Map<string, number>();
    nodes.forEach((n) => indeg.set(n.id, 0));
    edges.forEach((e) => { if (indeg.has(e.target)) indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1); });
    const levels = new Map<string, number>();
    const visit = (id: string, lvl: number) => { levels.set(id, Math.max(levels.get(id) ?? 0, lvl)); edges.filter((e) => e.source === id).forEach((e) => visit(e.target, lvl + 1)); };
    nodes.filter((n) => (indeg.get(n.id) ?? 0) === 0).forEach((n) => visit(n.id, 0));
    nodes.forEach((n) => levels.set(n.id, levels.get(n.id) ?? 0));
    const byLevel = new Map<number, Node[]>();
    nodes.forEach((n) => { const l = levels.get(n.id)!; if (!byLevel.has(l)) byLevel.set(l, []); byLevel.get(l)!.push(n); });
    const positioned = nodes.map((n) => { const l = levels.get(n.id)!; const col = byLevel.get(l)!; return { ...n, position: { x: 60 + l * 300, y: 60 + col.indexOf(n) * 160 } }; });
    setRfNodes((nds) => [...nds.filter((n) => CANVAS_TYPES.has(n.type ?? "")), ...positioned]);
    setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 50);
  }, [getNodes, rfEdges, setRfNodes, fitView, snapshot]);

  useEffect(() => () => { sseHandle.current?.abort(); }, []);

  const nodeCount = rfNodes.filter((n) => !CANVAS_TYPES.has(n.type ?? "")).length;
  const statusTone: Tone = initial.status === "active" ? "success" : initial.status === "error" ? "danger" : initial.status === "paused" ? "warning" : "neutral";

  const graphContext = useMemo(() => ({ nodes: fromFlowNodes(rfNodes), edges: domainEdges(rfEdges) }), [rfNodes, rfEdges]);

  // "Build with AI" from the palette: on desktop (xl+) just reveal the inline
  // copilot panel; below xl, also slide in the mobile copilot drawer.
  const openCopilot = () => {
    setCopilotOpen(true);
    if (!isXlPlus) setRightDrawerOpen(true);
  };

  // Shared copilot/inspector block — rendered both in the desktop right aside
  // and the mobile right drawer, so the swap animation + tabs live in one place.
  const renderRightPanel = () => (
    <AnimatePresence mode="wait">
      {copilotOpen ? (
        <motion.div key="copilot" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0">
          <CopilotPanel
            workflowName={name}
            graph={graphContext}
            selectedNode={selectedNode}
            onGenerate={handleGenerate}
            onInsertNode={(t) => insertNode(t)}
            diagnoseSignal={diagnoseSignal}
          />
        </motion.div>
      ) : (
        <motion.div key="inspector" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0">
          <div className="flex items-center justify-between border-b border-border p-2">
            <button onClick={() => setCopilotOpen(true)} className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-fg-muted hover:bg-surface-2 hover:text-fg">
              <Icon name="ArrowLeft" className="h-3.5 w-3.5" /> Copilot
            </button>
            <span className="text-[10px] text-fg-subtle">Inspector</span>
          </div>
          <Inspector node={selectedNode} onUpdate={onUpdate} onRetry={retryNode} onDelete={deleteNode} onToggleBreakpoint={toggleBreakpoint} />
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col -m-4 lg:-m-8">
      {/* Middle row: Node Library | Canvas | Copilot. Uses normal flex flow —
          no absolute/floating panels — so the three columns never overlap. */}
      <div className="flex min-h-0 flex-1">
        {/* Left: Node Library (desktop ≥ md). On tablet/mobile it lives in the
            slide-over drawer below. NodePalette already owns its sticky header
            and independent scroll, so the aside is just a sized flex column. */}
        <aside className="hidden md:flex w-72 shrink-0 flex-col border-r border-border bg-bg-soft/60">
          <NodePalette onAISuggest={openCopilot} />
        </aside>

        {/* Center: in-flow toolbar + canvas + execution, stacked vertically.
            All three belong to this column only, so they can never cover the
            side panels, and the side panels run the editor's full height. */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="relative z-20 flex flex-col gap-1 border-b border-border bg-surface-2/95 px-2 py-1.5 backdrop-blur-xl">
            {/* Row 1 — identity: back, workflow name, status, version, run.
                Always visible (mobile collapses to its essentials). The name
                input is the flexible element: min-w-0 lets it shrink instead of
                pushing its siblings, so the title can never overlap a control. */}
            <div className="flex items-center gap-1.5">
              <button onClick={() => setLeftDrawerOpen(true)} title="Node library" aria-label="Open node library" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-fg-muted hover:bg-surface-3 hover:text-fg md:hidden"><Icon name="PanelLeft" className="h-4 w-4" /></button>
              <button onClick={() => history.back()} title="Back" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-fg-muted hover:bg-surface-3 hover:text-fg"><Icon name="ArrowLeft" className="h-4 w-4" /></button>
              <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
                <Icon name="Workflow" className="hidden h-4 w-4 shrink-0 text-brand sm:block" />
                <input value={name} onChange={(e) => setName(e.target.value)} className="min-w-0 w-20 flex-1 max-w-40 rounded bg-transparent px-1 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-brand" />
                <Badge tone={statusTone} className="hidden shrink-0 sm:inline-flex">{initial.status}</Badge>
                <span className={cn("hidden shrink-0 items-center gap-1 text-[11px] xl:inline-flex", saveState === "saving" ? "text-fg-subtle" : "text-success")}>
                  {saveState === "saving" ? <><Icon name="LoaderCircle" className="h-3 w-3 animate-spin" /> Saving…</> : <><Icon name="Check" className="h-3 w-3" /> Saved</>}
                </span>
              </div>
              <div className="relative">
                <Button ref={versionTriggerRef} variant="secondary" size="sm" onClick={toggleVersionMenu} aria-haspopup="menu" aria-expanded={versionMenuOpen}>
                  <Icon name="History" className="h-3.5 w-3.5" /> <span className="hidden sm:inline">v{version}</span>
                </Button>
                {versionMenuOpen && (
                  <div ref={versionPanelRef} className="absolute right-0 top-9 z-30">
                    <VersionHistory
                      workflowId={workflowId}
                      versions={versions}
                      currentVersion={version}
                      onCompare={openCompare}
                      onSaved={(v) => { setVersion(v.version); setVersions((vs) => [v, ...vs.filter((x) => x.id !== v.id)]); }}
                      onRestored={(g, head) => { restoreVersion(g); setVersion(head.version); setVersions((vs) => [head, ...vs.filter((x) => x.id !== head.id)]); closeVersionMenu(); }}
                    />
                  </div>
                )}
              </div>
              <Button size="sm" variant={runStatus === "running" ? "danger" : "ai"} onClick={runWorkflow} className="shrink-0 min-w-[64px] sm:min-w-[96px]">
                {runStatus === "running" ? <><Icon name="Square" className="h-3.5 w-3.5" /> Stop</> : <><Icon name="Play" className="h-3.5 w-3.5" /> Run</>}
              </Button>
              {/* Below xl the inline Copilot panel is a drawer instead. */}
              <button onClick={openCopilot} title="AI Copilot" aria-label="Open AI Copilot" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-brand hover:bg-surface-3 xl:hidden"><Icon name="Sparkles" className="h-4 w-4" /></button>
            </div>

            {/* Row 2 — tools + actions. Hidden on mobile (< sm), where row 1
                essentials + keyboard shortcuts cover the same ground. A
                flex-1 spacer pins the actions to the right edge. Every control
                here is shrink-0, so they sit on a fixed-width rail and never
                overlap; row 1's flexible name absorbs any width changes. */}
            <div className="hidden items-center gap-1.5 sm:flex">
              <button title="Undo (⌘Z)" onClick={() => { const prev = undoStack.current.pop(); if (prev) { redoStack.current.push({ nodes: JSON.parse(JSON.stringify(rfNodes)), edges: JSON.parse(JSON.stringify(rfEdges)), viewport: getViewport() }); restore(prev); } }} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-fg-muted hover:bg-surface-3 hover:text-fg"><Icon name="Undo2" className="h-3.5 w-3.5" /></button>
              <button title="Redo (⌘⇧Z)" onClick={() => { const next = redoStack.current.pop(); if (next) { undoStack.current.push({ nodes: JSON.parse(JSON.stringify(rfNodes)), edges: JSON.parse(JSON.stringify(rfEdges)), viewport: getViewport() }); restore(next); } }} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-fg-muted hover:bg-surface-3 hover:text-fg"><Icon name="Redo2" className="h-3.5 w-3.5" /></button>
              <button title="Auto layout" onClick={autoLayout} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-fg-muted hover:bg-surface-3 hover:text-fg"><Icon name="LayoutGrid" className="h-3.5 w-3.5" /></button>
              <button title="Fit view (F)" onClick={() => fitView({ padding: 0.2, duration: 300 })} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-fg-muted hover:bg-surface-3 hover:text-fg"><Icon name="Maximize" className="h-3.5 w-3.5" /></button>
              <button title="Search nodes (/)" onClick={() => setSearchOpen(true)} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-fg-muted hover:bg-surface-3 hover:text-fg"><Icon name="Search" className="h-3.5 w-3.5" /></button>
              <div className="flex-1" />
              <Button variant="secondary" size="sm" onClick={() => setOptimizerOpen(true)} title="AI Cost Optimizer (preflight estimate)" className="hidden md:inline-flex">
                <Icon name="Calculator" className="h-3.5 w-3.5" /> <span className="hidden lg:inline">Cost</span>
              </Button>
              {/* Desktop (≥ xl): toggle the inline copilot/inspector panel. */}
              <Button variant="secondary" size="sm" onClick={() => setCopilotOpen((o) => !o)} title="Copilot" className="hidden xl:inline-flex">
                <Icon name="Sparkles" className="h-3.5 w-3.5" /> <span className="hidden 2xl:inline">Copilot</span>
              </Button>
              <Button variant="secondary" size="sm" onClick={() => { setSimulateGraph(graphForApi()); setSimulateOpen(true); }} title="Simulate (dry run — no external calls, no DB writes, no credits)" className="hidden md:inline-flex">
                <Icon name="FlaskConical" className="h-3.5 w-3.5" /> <span className="hidden lg:inline">Simulate</span>
              </Button>
            </div>
          </div>

          {/* Canvas. relative (no z-index) so the fixed z-50 modals below escape
              to the viewport and still paint above the z-20 toolbar. */}
          <div className="relative min-h-0 flex-1">
            <ReactFlow
              nodes={rfNodes}
              edges={rfEdges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodesChange={handleNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onNodeClick={(_, n) => setSelectedId(n.id)}
              onPaneClick={() => setSelectedId(null)}
              onPaneContextMenu={onPaneContextMenu}
              onNodeContextMenu={onNodeContextMenu}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              snapToGrid
              snapGrid={[16, 16]}
              defaultEdgeOptions={{ type: "custom", style: EDGE_STYLE, markerEnd: EDGE_MARKER }}
              proOptions={{ hideAttribution: true }}
              className="bg-bg"
            >
              <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#1f2330" />
              <Controls className="border! border-border! rounded-lg! overflow-hidden!" />
              <MiniMap pannable zoomable nodeColor={(n) => getNodeDef((n.data as { __type?: string }).__type ?? (n.type === "agentflow" ? "util.delay" : n.type ?? ""))?.color ?? "#3a3f52"} className="border! border-border! rounded-lg!" maskColor="rgba(7,8,12,0.7)" />
            </ReactFlow>

            {/* Empty-state — centered in the canvas, behind the modals. */}
            {nodeCount === 0 && (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-4">
                <div className="pointer-events-auto flex max-w-sm flex-col items-center gap-3 rounded-2xl border border-border bg-surface-2/90 p-6 text-center shadow-xl backdrop-blur-xl">
                  <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand-soft text-brand">
                    <Icon name="Sparkles" className="h-6 w-6" />
                  </div>
                  <h3 className="text-sm font-semibold">
                    {templateOrigin ? <>Start building “{templateOrigin.name}”</> : "Start building your workflow"}
                  </h3>
                  <p className="text-xs text-fg-muted">
                    {templateOrigin
                      ? "This template provides the workflow structure and metadata. Add nodes to configure the automation."
                      : "Add a node from the palette on the left, or press / to search the node catalog."}
                  </p>
                  <Button size="sm" variant="ai" onClick={() => setSearchOpen(true)}>
                    <Icon name="Plus" className="h-3.5 w-3.5" /> Add node
                  </Button>
                </div>
              </div>
            )}

            {searchOpen && <NodeSearch onClose={() => setSearchOpen(false)} onPick={(t) => insertNode(t)} />}
            {ctx && <ContextMenu x={ctx.x} y={ctx.y} actions={ctxActions} onClose={() => setCtx(null)} />}
            {compareOpen && (
              <VersionCompareModal workflowId={workflowId} versions={versions} initialFrom={compareFrom} initialTo={compareTo} onClose={() => setCompareOpen(false)} />
            )}
            {optimizerOpen && (
              <CostOptimizer workflowId={workflowId} onClose={() => setOptimizerOpen(false)} />
            )}
            {simulateOpen && simulateGraph && (
              <SimulationModal workflowId={workflowId} graph={simulateGraph} onClose={() => setSimulateOpen(false)} />
            )}
          </div>

          {/* Execution console — bottom section of the center editor only.
              Collapsed it is just the header strip; expanded it consumes
              vertical space and pushes the canvas up. It never spans the side
              panels and never overlaps them. */}
          <div className="shrink-0">
            <ExecutionDock
              open={dockOpen}
              onToggle={() => setDockOpen((o) => !o)}
              status={runStatus}
              log={runLog}
              steps={steps}
              totals={totals}
              workflowId={workflowId}
              executionId={currentExecutionId}
              replayingId={replayingId}
              onRun={runWorkflow}
              onPause={pauseRunCb}
              onResume={resumeRun}
              onStep={stepRunCb}
              onStop={stopRun}
              onRetryNode={retryNode}
              onReplayNode={replayNode}
              onDiagnose={(nodeId) => { setSelectedId(nodeId); setCopilotOpen(true); if (!isXlPlus) setRightDrawerOpen(true); setDiagnoseSignal((s) => s + 1); }}
            />
          </div>
        </div>

        {/* Right: Copilot / Inspector (desktop ≥ lg). Full-height column; the
            shared block is rendered via renderRightPanel() so the mobile
            drawer reuses it. */}
        <aside className="relative hidden w-80 shrink-0 flex-col border-l border-border bg-bg-soft/60 xl:flex">
          {renderRightPanel()}
        </aside>
      </div>

      {/* Mobile node-library drawer (< md). NodePalette fills the panel; the
          close button overlays its header's empty right side. */}
      <AnimatePresence>
        {leftDrawerOpen && !isMdPlus && (
          <>
            <motion.div key="left-backdrop" className="fixed inset-0 z-40 bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setLeftDrawerOpen(false)} />
            <motion.aside key="left-drawer" className="fixed inset-y-0 left-0 z-50 w-72 border-r border-border bg-bg-soft shadow-2xl" initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ type: "spring", stiffness: 400, damping: 35 }}>
              <button onClick={() => setLeftDrawerOpen(false)} aria-label="Close node library" className="absolute right-2 top-2.5 z-10 grid h-7 w-7 place-items-center rounded-md text-fg-muted hover:bg-surface-2 hover:text-fg"><Icon name="X" className="h-4 w-4" /></button>
              <NodePalette onAISuggest={openCopilot} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Copilot/inspector drawer (< xl). Reuses renderRightPanel(); the
          panel's absolute inset-0 children fill this relative container. */}
      <AnimatePresence>
        {rightDrawerOpen && !isXlPlus && (
          <>
            <motion.div key="right-backdrop" className="fixed inset-0 z-40 bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setRightDrawerOpen(false)} />
            <motion.aside key="right-drawer" className="fixed inset-y-0 right-0 z-50 w-80 border-l border-border bg-bg-soft shadow-2xl" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 400, damping: 35 }}>
              <button onClick={() => setRightDrawerOpen(false)} aria-label="Close copilot" className="absolute right-2 top-2.5 z-10 grid h-7 w-7 place-items-center rounded-md bg-surface-2/70 text-fg-muted hover:bg-surface-2 hover:text-fg"><Icon name="X" className="h-4 w-4" /></button>
              {renderRightPanel()}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Builder({ initial }: { initial: InitialWorkflow }) {
  return (
    <ReactFlowProvider>
      <BuilderInner initial={initial} />
    </ReactFlowProvider>
  );
}