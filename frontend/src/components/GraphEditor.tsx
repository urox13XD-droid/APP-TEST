"use client";

import { useMemo, useState } from "react";
import { Circle, Image as KonvaImage, Layer, Path, Stage } from "react-konva";
import type { GraphEdge, LineGraph } from "@shared/types";
import { applyEdit } from "@/lib/api";
import { useImage } from "@/lib/useImage";

type Tool = "select" | "move" | "bridge" | "connect" | "merge";

const TOOLS: { key: Tool; label: string; hint: string }[] = [
  { key: "select", label: "Sélectionner", hint: "Cliquer une ligne pour la supprimer/épaissir" },
  { key: "move", label: "Déplacer", hint: "Glisser un nœud" },
  { key: "bridge", label: "Pont", hint: "Cliquer 2 nœuds pour les relier (pont)" },
  { key: "connect", label: "Connexion", hint: "Cliquer 2 nœuds pour ajouter une ligne" },
  { key: "merge", label: "Fusionner", hint: "Cliquer 2 nœuds pour les fusionner" },
];

function edgePathData(graph: LineGraph, edge: GraphEdge): string {
  const source = graph.nodes.find((n) => n.id === edge.source);
  const target = graph.nodes.find((n) => n.id === edge.target);
  if (!source || !target) return "";
  if (edge.type === "cubic" && edge.control_points.length === 2) {
    const [c1, c2] = edge.control_points;
    return `M ${source.x},${source.y} C ${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${target.x},${target.y}`;
  }
  if (edge.type === "quad" && edge.control_points.length === 1) {
    const [c1] = edge.control_points;
    return `M ${source.x},${source.y} Q ${c1[0]},${c1[1]} ${target.x},${target.y}`;
  }
  return `M ${source.x},${source.y} L ${target.x},${target.y}`;
}

interface Props {
  sessionId: string;
  imageUrl: string;
  graph: LineGraph;
  onGraphChange: (graph: LineGraph) => void;
}

const MAX_DISPLAY_WIDTH = 640;

export default function GraphEditor({ sessionId, imageUrl, graph, onGraphChange }: Props) {
  const bgImage = useImage(imageUrl);
  const [tool, setTool] = useState<Tool>("select");
  const [selectedEdgeId, setSelectedEdgeId] = useState<number | null>(null);
  const [pendingNode, setPendingNode] = useState<number | null>(null);
  const [thickenWidth, setThickenWidth] = useState(graph.width_mm);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const displayScale = useMemo(
    () => Math.min(1, MAX_DISPLAY_WIDTH / graph.image_width),
    [graph.image_width]
  );

  const selectedEdge = graph.edges.find((e) => e.id === selectedEdgeId) ?? null;

  async function runOp(op: Parameters<typeof applyEdit>[1]) {
    setBusy(true);
    setLocalError(null);
    try {
      const res = await applyEdit(sessionId, op);
      onGraphChange(res.graph);
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setBusy(false);
    }
  }

  function handleNodeClick(nodeId: number) {
    if (tool === "select" || tool === "move" || busy) return;
    if (pendingNode === null) {
      setPendingNode(nodeId);
      return;
    }
    if (pendingNode === nodeId) {
      setPendingNode(null);
      return;
    }
    const a = pendingNode;
    setPendingNode(null);
    if (tool === "bridge") runOp({ type: "add_bridge", node_a: a, node_b: nodeId });
    else if (tool === "connect") runOp({ type: "add_connection", node_a: a, node_b: nodeId });
    else if (tool === "merge") runOp({ type: "merge_nodes", node_a: a, node_b: nodeId });
  }

  function handleEdgeClick(edgeId: number) {
    setSelectedEdgeId(edgeId);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1">
        {TOOLS.map((t) => (
          <button
            key={t.key}
            title={t.hint}
            onClick={() => {
              setTool(t.key);
              setPendingNode(null);
            }}
            className={`rounded px-2 py-1 text-xs font-medium ${
              tool === t.key
                ? "bg-blue-600 text-white"
                : "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="overflow-auto rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <Stage
          width={graph.image_width * displayScale}
          height={graph.image_height * displayScale}
          scaleX={displayScale}
          scaleY={displayScale}
        >
          <Layer listening={false}>
            {bgImage && <KonvaImage image={bgImage} opacity={0.35} />}
          </Layer>
          <Layer>
            {graph.edges.map((edge) => (
              <Path
                key={edge.id}
                data={edgePathData(graph, edge)}
                stroke={
                  edge.id === selectedEdgeId ? "#2563eb" : edge.is_bridge ? "#e11d48" : "#111111"
                }
                strokeWidth={(edge.id === selectedEdgeId ? 3 : 2) / displayScale}
                dash={edge.is_bridge ? [6 / displayScale, 4 / displayScale] : undefined}
                hitStrokeWidth={10 / displayScale}
                onClick={() => handleEdgeClick(edge.id)}
                onTap={() => handleEdgeClick(edge.id)}
              />
            ))}
            {graph.nodes.map((node) => (
              <Circle
                key={node.id}
                x={node.x}
                y={node.y}
                radius={(pendingNode === node.id ? 6 : 4) / displayScale}
                fill={pendingNode === node.id ? "#f59e0b" : "#2563eb"}
                draggable={tool === "move"}
                onClick={() => handleNodeClick(node.id)}
                onTap={() => handleNodeClick(node.id)}
                onDragEnd={(e) =>
                  runOp({ type: "move_node", node_id: node.id, x: e.target.x(), y: e.target.y() })
                }
              />
            ))}
          </Layer>
        </Stage>
      </div>

      {(pendingNode !== null || busy) && (
        <p className="text-xs text-neutral-500">
          {busy ? "Application de la modification…" : "Sélectionner un second nœud…"}
        </p>
      )}

      {selectedEdge && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 p-2 text-sm dark:border-neutral-800">
          <span>Arête #{selectedEdge.id}{selectedEdge.is_bridge ? " (pont)" : ""}</span>
          <button
            onClick={() => runOp({ type: "delete_edge", edge_id: selectedEdge.id })}
            disabled={busy}
            className="rounded bg-red-600 px-2 py-1 text-xs text-white disabled:opacity-50"
          >
            Supprimer
          </button>
          <input
            type="number"
            min={0.5}
            step={0.5}
            value={thickenWidth}
            onChange={(e) => setThickenWidth(Number(e.target.value))}
            className="w-16 rounded border border-neutral-300 px-1 py-0.5 dark:border-neutral-700 dark:bg-neutral-900"
          />
          <button
            onClick={() =>
              runOp({ type: "thicken_edge", edge_id: selectedEdge.id, width_mm: thickenWidth })
            }
            disabled={busy}
            className="rounded bg-neutral-700 px-2 py-1 text-xs text-white disabled:opacity-50"
          >
            Épaissir cette branche
          </button>
        </div>
      )}

      {localError && <p className="text-xs text-red-500">{localError}</p>}
    </div>
  );
}
