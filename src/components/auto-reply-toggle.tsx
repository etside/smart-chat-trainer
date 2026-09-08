import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  updateExtraSettings,
  getPendingDrafts,
  approveDraft,
  regenerateDraft,
  dismissDraft,
} from "@/lib/extra-settings.functions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

type AutoReplyMode = "on" | "off" | "standby";

interface AutoReplyToggleProps {
  currentMode: AutoReplyMode;
}

const modeConfig = {
  on: {
    label: "Auto-Reply ON",
    description: "AI automatically replies to all messages",
    color: "bg-green-500 hover:bg-green-600",
    icon: "●",
  },
  off: {
    label: "Auto-Reply OFF",
    description: "AI drafts replies — review and send manually",
    color: "bg-gray-400 hover:bg-gray-500",
    icon: "○",
  },
  standby: {
    label: "Standby",
    description: "AI drafts replies — review and send manually",
    color: "bg-amber-400 hover:bg-amber-500",
    icon: "◐",
  },
};

const modes: AutoReplyMode[] = ["on", "off", "standby"];

export function AutoReplyToggle({ currentMode }: AutoReplyToggleProps) {
  const [mode, setMode] = useState<AutoReplyMode>(currentMode);
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const getDraftsFn = useServerFn(getPendingDrafts);
  const approveFn = useServerFn(approveDraft);
  const regenFn = useServerFn(regenerateDraft);
  const dismissFn = useServerFn(dismissDraft);

  const { data: drafts, isLoading: draftsLoading } = useQuery({
    queryKey: ["pendingDrafts"],
    queryFn: () => getDraftsFn(),
    refetchInterval: 10000,
  });

  const handleToggle = async (newMode: AutoReplyMode) => {
    if (newMode === mode) return;
    setLoading(true);
    try {
      await updateExtraSettings({ data: { autoReplyMode: newMode } });
      setMode(newMode);
      queryClient.invalidateQueries({ queryKey: ["extraSettings"] });
    } catch (err) {
      console.error("Failed to update auto-reply mode:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (logId: string) => {
    await approveFn({ data: { logId } });
    queryClient.invalidateQueries({ queryKey: ["pendingDrafts"] });
  };

  const handleRegenerate = async (logId: string) => {
    await regenFn({ data: { logId } });
    queryClient.invalidateQueries({ queryKey: ["pendingDrafts"] });
  };

  const handleDismiss = async (logId: string) => {
    await dismissFn({ data: { logId } });
    queryClient.invalidateQueries({ queryKey: ["pendingDrafts"] });
  };

  const config = modeConfig[mode];

  return (
    <div className="space-y-4">
      {/* Mode toggle buttons */}
      <div className="flex items-center gap-2">
        <span className="text-lg">{config.icon}</span>
        <span className="font-medium">{config.label}</span>
      </div>
      <p className="text-sm text-muted-foreground">{config.description}</p>
      <div className="flex gap-2">
        {modes.map((m) => (
          <Button
            key={m}
            variant={m === mode ? "default" : "outline"}
            size="sm"
            className={m === mode ? modeConfig[m].color : ""}
            onClick={() => handleToggle(m)}
            disabled={loading}
          >
            {modeConfig[m].label}
          </Button>
        ))}
      </div>

      {/* Pending drafts */}
      {drafts && drafts.length > 0 && (
        <div className="mt-4 space-y-3">
          <h4 className="text-sm font-semibold">
            Pending Replies ({drafts.length})
          </h4>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {drafts.map((draft: any) => (
              <div
                key={draft.id}
                className="rounded-lg border p-3 space-y-2 text-sm"
              >
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{draft.sender || "Unknown"}</span>
                  <span>
                    {new Date(draft.created_at).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Customer: </span>
                  {draft.message}
                </div>
                <div className="bg-muted rounded p-2">
                  <span className="font-medium">AI Draft: </span>
                  {draft.draft_reply}
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => handleApprove(draft.id)}
                  >
                    Send
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRegenerate(draft.id)}
                  >
                    Regenerate
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-500"
                    onClick={() => handleDismiss(draft.id)}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {drafts && drafts.length === 0 && (
        <p className="text-sm text-muted-foreground">No pending replies.</p>
      )}
    </div>
  );
}
