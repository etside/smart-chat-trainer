import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createFlow,
  deleteFlow,
  getFlow,
  listFlows,
  saveFlow,
} from "@/lib/flow-builder.functions";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ArrowRight,
  Circle,
  Plus,
  Trash2,
  Play,
  MessageSquare,
  Keyboard,
  GitBranch,
  Square,
  GripVertical,
  Save,
  Loader2,
  X,
  Edit3,
  Smartphone,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/flow-builder")({
  component: FlowBuilderPage,
});

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type FlowSummary = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

type NodeType = "start" | "message" | "user_input" | "condition" | "end";

type FlowNode = {
  id: string;
  type: NodeType;
  label: string;
  content: string;
  conditions?: string | null;
  x: number;
  y: number;
};

type FlowEdge = {
  id: string;
  sourceId: string;
  targetId: string;
  label?: string;
};

type FlowData = {
  id: string;
  name: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const NODE_WIDTH = 200;
const NODE_HEIGHT = 100;

const NODE_CONFIG: Record<
  NodeType,
  { label: string; color: string; icon: typeof Play; bangla: string }
> = {
  start: {
    label: "Start",
    color: "bg-green-500/15 border-green-500/40 text-green-700 dark:text-green-400",
    icon: Play,
    bangla: "শুরু",
  },
  message: {
    label: "Message",
    color: "bg-blue-500/15 border-blue-500/40 text-blue-700 dark:text-blue-400",
    icon: MessageSquare,
    bangla: "বার্তা",
  },
  user_input: {
    label: "User Input",
    color: "bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-400",
    icon: Keyboard,
    bangla: "ইউজার ইনপুট",
  },
  condition: {
    label: "Condition",
    color: "bg-purple-500/15 border-purple-500/40 text-purple-700 dark:text-purple-400",
    icon: GitBranch,
    bangla: "শর্ত",
  },
  end: {
    label: "End",
    color: "bg-red-500/15 border-red-500/40 text-red-700 dark:text-red-400",
    icon: Square,
    bangla: "শেষ",
  },
};

let nodeCounter = 0;
function makeNodeId() {
  return `node_${Date.now()}_${++nodeCounter}`;
}
function makeEdgeId() {
  return `edge_${Date.now()}_${++nodeCounter}`;
}

/* ------------------------------------------------------------------ */
/*  FlowListPage                                                       */
/* ------------------------------------------------------------------ */

function FlowBuilderPage() {
  const [editingFlowId, setEditingFlowId] = useState<string | null>(null);

  if (editingFlowId) {
    return (
      <FlowEditor
        flowId={editingFlowId}
        onBack={() => setEditingFlowId(null)}
      />
    );
  }

  return <FlowList onSelect={(id) => setEditingFlowId(id)} />;
}

/* ------------------------------------------------------------------ */
/*  FlowList                                                           */
/* ------------------------------------------------------------------ */

function FlowList({ onSelect }: { onSelect: (id: string) => void }) {
  const qc = useQueryClient();
  const fetchFlows = useServerFn(listFlows);
  const deleteFlowFn = useServerFn(deleteFlow);
  const createFlowFn = useServerFn(createFlow);

  const { data: flows, isLoading } = useQuery({
    queryKey: ["admin-flows"],
    queryFn: () => fetchFlows(),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const createMutation = useMutation({
    mutationFn: () =>
      createFlow({ data: { name: newName.trim(), description: newDesc.trim() || undefined } }),
    onSuccess: (data: any) => {
      toast.success("নতুন ফ্লো তৈরি হয়েছে");
      qc.invalidateQueries({ queryKey: ["admin-flows"] });
      setNewName("");
      setNewDesc("");
      setShowCreate(false);
      onSelect(data.id as string);
    },
    onError: () => toast.error("ফ্লো তৈরি করা যায়নি"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFlow({ data: { id } }),
    onSuccess: () => {
      toast.success("ফ্লো মুছে ফেলা হয়েছে");
      qc.invalidateQueries({ queryKey: ["admin-flows"] });
    },
    onError: () => toast.error("ফ্লো মুছে ফেলা যায়নি"),
  });

  return (
    <div className="mx-auto max-w-4xl animate-in fade-in duration-500 pb-20">
      {/* Mobile notice */}
      <div className="md:hidden mb-6">
        <div className="panel p-4 flex items-center gap-3 bg-amber-500/5 border-amber-500/20">
          <Smartphone className="size-5 text-amber-600 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-400">
            ফ্লো বিল্ডার ডেস্কটপে বেশি ভালো কাজ করে। ডেস্কটপ ব্রাউজারে খুলে দেখুন।
          </p>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <GitBranch className="size-8 text-primary" /> ফ্লো বিল্ডার
          </h1>
          <p className="mt-2 text-muted-foreground">
            কথোপকথনের ফ্লো তৈরি ও পরিচালনা করুন।
          </p>
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          className="hidden md:flex"
        >
          <Plus className="size-4 mr-2" /> নতুন ফ্লো
        </Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="panel p-5 mb-6 animate-in fade-in duration-300">
          <h3 className="text-sm font-bold mb-3">নতুন ফ্লো তৈরি করুন</h3>
          <div className="grid gap-3">
            <div>
              <Label className="text-xs font-bold">নাম *</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="যেমন: সেলস ইন্টারভিউ"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-bold">বিবরণ</Label>
              <Input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="ঐচ্ছিক বিবরণ"
                className="mt-1"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowCreate(false);
                  setNewName("");
                  setNewDesc("");
                }}
              >
                বাতিল
              </Button>
              <Button
                size="sm"
                onClick={() => createMutation.mutate()}
                disabled={!newName.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <Loader2 className="size-3.5 mr-1 animate-spin" />
                ) : (
                  <Plus className="size-3.5 mr-1" />
                )}
                তৈরি করুন
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile create button */}
      <div className="md:hidden mb-4">
        <Button
          onClick={() => setShowCreate(true)}
          className="w-full"
          variant="outline"
        >
          <Plus className="size-4 mr-2" /> নতুন ফ্লো তৈরি করুন
        </Button>
      </div>

      {/* Flow list */}
      {isLoading ? (
        <div className="panel p-10 text-center">
          <Loader2 className="size-6 mx-auto animate-spin text-primary" />
          <p className="text-sm text-muted-foreground mt-2">লোড হচ্ছে...</p>
        </div>
      ) : flows && flows.length > 0 ? (
        <div className="grid gap-3">
          {flows.map((flow: FlowSummary) => (
            <div
              key={flow.id}
              className="panel panel-hover p-5 flex flex-col md:flex-row md:items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold truncate">{flow.name}</h3>
                  {flow.is_active ? (
                    <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30 text-[10px]">
                      সক্রিয়
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">
                      নিষ্ক্রিয়
                    </Badge>
                  )}
                </div>
                {flow.description && (
                  <p className="text-xs text-muted-foreground truncate">
                    {flow.description}
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground mt-1">
                  আপডেট:{" "}
                  {flow.updated_at ? new Date(flow.updated_at).toLocaleDateString("bn-BD", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  }) : "N/A"}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onSelect(flow.id)}
                  className="hidden md:flex"
                >
                  <Edit3 className="size-3.5 mr-1" /> এডিট করুন
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onSelect(flow.id)}
                  className="md:hidden"
                >
                  খুলুন <ArrowRight className="size-3.5 ml-1" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 hover:border-destructive/30"
                  onClick={() => {
                    if (confirm(`"${flow.name}" মুছে ফেলতে চান?`)) {
                      deleteMutation.mutate(flow.id);
                    }
                  }}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="panel p-10 text-center">
          <GitBranch className="size-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">
            কোনো ফ্লো নেই। প্রথম ফ্লো তৈরি করুন।
          </p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  FlowEditor                                                         */
/* ------------------------------------------------------------------ */

function FlowEditor({
  flowId,
  onBack,
}: {
  flowId: string;
  onBack: () => void;
}) {
  const qc = useQueryClient();
  const fetchFlow = useServerFn(getFlow);
  const saveFlowFn = useServerFn(saveFlow);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-flow", flowId],
    queryFn: () => fetchFlow({ data: { id: flowId } }),
  });

  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [edges, setEdges] = useState<FlowEdge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [flowName, setFlowName] = useState("");
  const [flowActive, setFlowActive] = useState(false);
  const [isDragging, setIsDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Hydrate from fetched data
  useEffect(() => {
    if (!data) return;
    setFlowName(data.name ?? "");
    setFlowActive(Boolean(data.is_active));
    try {
      setNodes(typeof data.nodes === "string" ? JSON.parse(data.nodes) : (data.nodes ?? []));
      setEdges(typeof data.edges === "string" ? JSON.parse(data.edges) : (data.edges ?? []));
    } catch {
      setNodes([]);
      setEdges([]);
    }
  }, [data]);

  // Persist helper: save without re-query
  const saveMutation = useMutation({
    mutationFn: (overrides?: { nodes?: FlowNode[]; edges?: FlowEdge[] }) =>
      saveFlow({
        data: {
          id: flowId,
          nodes: JSON.stringify(overrides?.nodes ?? nodes),
          edges: JSON.stringify(overrides?.edges ?? edges),
          name: flowName,
          is_active: flowActive,
        },
      }),
    onSuccess: () => {
      toast.success("সেভ হয়েছে");
      qc.invalidateQueries({ queryKey: ["admin-flows"] });
    },
    onError: () => toast.error("সেভ করা যায়নি"),
  });

  const handleSave = () => {
    saveMutation.mutate();
  };

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );

  /* ---- Node CRUD ---- */

  const addNode = (type: NodeType) => {
    const id = makeNodeId();
    const offsetX = 80 + Math.random() * 200;
    const offsetY = 80 + nodes.length * 120;
    const newNode: FlowNode = {
      id,
      type,
      label: NODE_CONFIG[type].bangla,
      content: "",
      conditions: type === "condition" ? "" : null,
      x: offsetX,
      y: offsetY,
    };
    setNodes((prev) => [...prev, newNode]);
    setSelectedNodeId(id);
  };

  const updateNode = (id: string, patch: Partial<FlowNode>) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, ...patch } : n)),
    );
  };

  const removeNode = (id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setEdges((prev) =>
      prev.filter((e) => e.sourceId !== id && e.targetId !== id),
    );
    if (selectedNodeId === id) setSelectedNodeId(null);
  };

  /* ---- Edge CRUD ---- */

  const addEdge = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const exists = edges.some(
      (e) => e.sourceId === sourceId && e.targetId === targetId,
    );
    if (exists) return;
    setEdges((prev) => [
      ...prev,
      { id: makeEdgeId(), sourceId, targetId },
    ]);
  };

  const removeEdge = (edgeId: string) => {
    setEdges((prev) => prev.filter((e) => e.id !== edgeId));
  };

  /* ---- Canvas node position helpers ---- */

  const updateNodePosition = useCallback(
    (nodeId: string, x: number, y: number) => {
      setNodes((prev) =>
        prev.map((n) => (n.id === nodeId ? { ...n, x, y } : n)),
      );
    },
    [],
  );

  /* ---- Drag handlers (pointer) ---- */

  const onPointerDown = (e: React.PointerEvent, nodeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    setIsDragging(nodeId);
    setDragOffset({
      x: e.clientX - node.x,
      y: e.clientY - node.y,
    });
    setSelectedNodeId(nodeId);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = Math.max(0, e.clientX - rect.left - dragOffset.x + (canvasRef.current.scrollLeft || 0));
      const y = Math.max(0, e.clientY - rect.top - dragOffset.y + (canvasRef.current.scrollTop || 0));
      updateNodePosition(isDragging, x, y);
    },
    [isDragging, dragOffset, updateNodePosition],
  );

  const onPointerUp = useCallback(() => {
    setIsDragging(null);
  }, []);

  /* ---- Edge line coords ---- */

  const getNodeCenter = useCallback(
    (nodeId: string) => {
      const n = nodes.find((nd) => nd.id === nodeId);
      if (!n) return { x: 0, y: 0 };
      return { x: n.x + NODE_WIDTH / 2, y: n.y + NODE_HEIGHT / 2 };
    },
    [nodes],
  );

  /* ---- Connect mode: click second node to create edge ---- */

  const handleNodeClick = (nodeId: string) => {
    if (connectingFrom) {
      addEdge(connectingFrom, nodeId);
      setConnectingFrom(null);
    } else {
      setSelectedNodeId(nodeId);
    }
  };

  /* ---- Loading state ---- */

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] animate-in fade-in duration-300">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="size-4" />
          </Button>
          <div className="min-w-0">
            <input
              value={flowName}
              onChange={(e) => setFlowName(e.target.value)}
              className="text-lg font-bold bg-transparent border-none outline-none w-full placeholder:text-muted-foreground"
              placeholder="ফ্লোর নাম"
            />
          </div>
          <label className="flex items-center gap-2 text-xs font-bold cursor-pointer select-none">
            <input
              type="checkbox"
              checked={flowActive}
              onChange={(e) => setFlowActive(e.target.checked)}
              className="size-3.5 rounded"
            />
            সক্রিয়
          </label>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={connectingFrom ? "default" : "outline"}
            size="sm"
            onClick={() =>
              setConnectingFrom((prev) => (prev ? null : selectedNodeId ?? nodes[0]?.id ?? null))
            }
          >
            <ArrowRight className="size-3.5 mr-1" />{" "}
            {connectingFrom ? "বাতিল" : "সংযোগ"}
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="size-3.5 mr-1 animate-spin" />
            ) : (
              <Save className="size-3.5 mr-1" />
            )}
            সেভ
          </Button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-1 gap-4 min-h-0">
        {/* Canvas */}
        <div className="flex-1 panel overflow-hidden relative flex flex-col">
          {/* Add-node toolbar */}
          <div className="flex items-center gap-2 p-3 border-b border-border/40 overflow-x-auto shrink-0">
            {(Object.keys(NODE_CONFIG) as NodeType[]).map((type) => {
              const cfg = NODE_CONFIG[type];
              const Icon = cfg.icon;
              return (
                <button
                  key={type}
                  onClick={() => addNode(type)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all hover:scale-105 shrink-0",
                    cfg.color,
                  )}
                >
                  <Icon className="size-3.5" />
                  {cfg.bangla}
                </button>
              );
            })}
          </div>

          {/* Canvas scroll area */}
          <div
            ref={canvasRef}
            className="flex-1 relative overflow-auto"
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            style={{ cursor: isDragging ? "grabbing" : "default" }}
          >
            <div
              className="relative"
              style={{
                width: Math.max(1200, ...nodes.map((n) => n.x + NODE_WIDTH + 200)),
                height: Math.max(800, ...nodes.map((n) => n.y + NODE_HEIGHT + 200)),
                minWidth: "100%",
                minHeight: "100%",
              }}
            >
              {/* SVG edges layer */}
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                style={{ zIndex: 0 }}
              >
                <defs>
                  <marker
                    id="arrowhead"
                    markerWidth="10"
                    markerHeight="7"
                    refX="9"
                    refY="3.5"
                    orient="auto"
                  >
                    <polygon
                      points="0 0, 10 3.5, 0 7"
                      fill="currentColor"
                      className="text-muted-foreground"
                    />
                  </marker>
                </defs>
                {edges.map((edge) => {
                  const from = getNodeCenter(edge.sourceId);
                  const to = getNodeCenter(edge.targetId);
                  const dx = to.x - from.x;
                  const dy = to.y - from.y;
                  const cx1 = from.x + dx * 0.4;
                  const cy1 = from.y;
                  const cx2 = to.x - dx * 0.4;
                  const cy2 = to.y;
                  return (
                    <g key={edge.id}>
                      <path
                        d={`M ${from.x} ${from.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${to.x} ${to.y}`}
                        fill="none"
                        stroke="currentColor"
                        className="text-muted-foreground/60"
                        strokeWidth="2"
                        markerEnd="url(#arrowhead)"
                        style={{ pointerEvents: "stroke", cursor: "pointer" }}
                        onClick={() => {
                          if (confirm("এই সংযোগ মুছে ফেলতে চান?")) {
                            removeEdge(edge.id);
                          }
                        }}
                      />
                      {edge.label && (
                        <text
                          x={(from.x + to.x) / 2}
                          y={(from.y + to.y) / 2 - 6}
                          textAnchor="middle"
                          className="fill-muted-foreground text-[10px]"
                        >
                          {edge.label}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>

              {/* Nodes */}
              {nodes.map((node) => {
                const cfg = NODE_CONFIG[node.type];
                const Icon = cfg.icon;
                const isSelected = selectedNodeId === node.id;
                const isConnectSource = connectingFrom === node.id;
                return (
                  <div
                    key={node.id}
                    className={cn(
                      "absolute border-2 rounded-xl p-3 cursor-grab select-none transition-shadow",
                      cfg.color,
                      isSelected && "ring-2 ring-primary ring-offset-2",
                      isConnectSource && "ring-2 ring-amber-400 ring-offset-2 animate-pulse",
                      isDragging === node.id && "opacity-90 z-50",
                    )}
                    style={{
                      left: node.x,
                      top: node.y,
                      width: NODE_WIDTH,
                      zIndex: isDragging === node.id ? 50 : isSelected ? 20 : 10,
                    }}
                    onPointerDown={(e) => onPointerDown(e, node.id)}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNodeClick(node.id);
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <GripVertical className="size-3 opacity-40 shrink-0" />
                      <Icon className="size-3.5 shrink-0" />
                      <span className="text-[10px] uppercase font-black tracking-wide truncate">
                        {cfg.bangla}
                      </span>
                    </div>
                    <p className="text-xs font-bold truncate ml-5">
                      {node.label || "নামহীন"}
                    </p>
                    {node.content && (
                      <p className="text-[10px] opacity-70 truncate ml-5 mt-0.5">
                        {node.content.slice(0, 40)}
                        {node.content.length > 40 && "..."}
                      </p>
                    )}
                    {node.type === "condition" && node.conditions && (
                      <p className="text-[10px] opacity-60 truncate ml-5 mt-0.5 italic">
                        {node.conditions.slice(0, 35)}
                      </p>
                    )}
                  </div>
                );
              })}

              {/* Empty state */}
              {nodes.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <GitBranch className="size-12 mx-auto text-muted-foreground/20 mb-3" />
                    <p className="text-sm text-muted-foreground/50">
                      উপরের বার থেকে নোড যোগ করুন
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right panel: node editor */}
        <div className="w-80 shrink-0 hidden md:flex flex-col gap-4">
          {selectedNode ? (
            <NodeEditor
              node={selectedNode}
              onUpdate={(patch) => updateNode(selectedNode.id, patch)}
              onDelete={() => removeNode(selectedNode.id)}
            />
          ) : (
            <div className="panel p-6 text-center flex-1 flex flex-col items-center justify-center">
              <Edit3 className="size-8 text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground">
                একটি নোড সিলেক্ট করুন এডিট করতে
              </p>
            </div>
          )}

          {/* Edge list */}
          {edges.length > 0 && (
            <div className="panel p-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">
                সংযোগসমূহ ({edges.length})
              </h4>
              <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                {edges.map((edge) => {
                  const src = nodes.find((n) => n.id === edge.sourceId);
                  const tgt = nodes.find((n) => n.id === edge.targetId);
                  return (
                    <div
                      key={edge.id}
                      className="flex items-center gap-1 text-[10px] text-muted-foreground"
                    >
                      <span className="truncate max-w-[70px] font-medium">
                        {src?.label || "?"}
                      </span>
                      <ArrowRight className="size-2.5 shrink-0" />
                      <span className="truncate max-w-[70px] font-medium">
                        {tgt?.label || "?"}
                      </span>
                      <button
                        onClick={() => removeEdge(edge.id)}
                        className="ml-auto text-destructive hover:text-destructive/80 shrink-0"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Mobile: no editor panel */}
        {selectedNode && (
          <div className="md:hidden fixed inset-x-0 bottom-0 z-40 panel rounded-t-2xl border-b-0 max-h-[60vh] overflow-y-auto">
            <div className="sticky top-0 bg-card/95 backdrop-blur-md p-3 border-b border-border/40 flex items-center justify-between">
              <h4 className="text-sm font-bold">নোড এডিটর</h4>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => setSelectedNodeId(null)}
              >
                <X className="size-4" />
              </Button>
            </div>
            <div className="p-4">
              <NodeEditor
                node={selectedNode}
                onUpdate={(patch) => updateNode(selectedNode.id, patch)}
                onDelete={() => {
                  removeNode(selectedNode.id);
                  setSelectedNodeId(null);
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  NodeEditor                                                         */
/* ------------------------------------------------------------------ */

function NodeEditor({
  node,
  onUpdate,
  onDelete,
}: {
  node: FlowNode;
  onUpdate: (patch: Partial<FlowNode>) => void;
  onDelete: () => void;
}) {
  const cfg = NODE_CONFIG[node.type];
  const Icon = cfg.icon;

  return (
    <div className="panel p-5 animate-in fade-in duration-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={cn("size-8 rounded-lg flex items-center justify-center", cfg.color)}>
            <Icon className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold">{cfg.bangla}</h3>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">
              ID: {node.id.slice(0, 12)}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="icon"
          className="size-7 text-destructive hover:bg-destructive/10"
          onClick={onDelete}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      <div className="space-y-3">
        <div>
          <Label className="text-xs font-bold">লেবেল</Label>
          <Input
            value={node.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
            placeholder="নোডের নাম"
            className="mt-1"
          />
        </div>

        {(node.type === "message" || node.type === "start" || node.type === "user_input") && (
          <div>
            <Label className="text-xs font-bold">
              {node.type === "user_input"
                ? "ইনপুট নির্দেশনা"
                : node.type === "message"
                  ? "বার্তা বিষয়বস্তু"
                  : "শুরুর বার্তা"}
            </Label>
            <Textarea
              value={node.content}
              onChange={(e) => onUpdate({ content: e.target.value })}
              placeholder={
                node.type === "user_input"
                  ? "ব্যবহারকারীকে কী জিজ্ঞাসা করবে..."
                  : "বট কী বলবে..."
              }
              rows={3}
              className="mt-1 text-sm"
            />
          </div>
        )}

        {node.type === "condition" && (
          <>
            <div>
              <Label className="text-xs font-bold">শর্ত</Label>
              <Textarea
                value={node.conditions ?? ""}
                onChange={(e) => onUpdate({ conditions: e.target.value })}
                placeholder="শর্ত লিখুন (যেমন: ইউজার বলেছে হ্যাঁ)"
                rows={2}
                className="mt-1 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs font-bold">শর্তের বিষয়বস্তু</Label>
              <Textarea
                value={node.content}
                onChange={(e) => onUpdate({ content: e.target.value })}
                placeholder="শর্ত পূরণ হলে কী হবে..."
                rows={2}
                className="mt-1 text-sm"
              />
            </div>
          </>
        )}

        {node.type === "end" && (
          <div>
            <Label className="text-xs font-bold">শেষের বার্তা</Label>
            <Textarea
              value={node.content}
              onChange={(e) => onUpdate({ content: e.target.value })}
              placeholder="কথোপকথন শেষে কী বলবে..."
              rows={2}
              className="mt-1 text-sm"
            />
          </div>
        )}
      </div>
    </div>
  );
}
