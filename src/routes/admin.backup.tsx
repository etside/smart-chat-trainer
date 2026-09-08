import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { generateBackup, listBackups, downloadBackup, restoreBackup } from '@/lib/backup.functions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useState, useRef } from 'react';
import {
  Download, Upload, RefreshCw, Database, Clock,
  CheckCircle2, Loader2, Shield, Archive,
} from 'lucide-react';
import { motion } from 'framer-motion';

export const Route = createFileRoute('/admin/backup')({ component: BackupPage });

const cardV = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as any } },
};
const containerV = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

function BackupPage() {
  const qc = useQueryClient();
  const doGenerate = useServerFn(generateBackup);
  const doList = useServerFn(listBackups);
  const doDownload = useServerFn(downloadBackup);
  const doRestore = useServerFn(restoreBackup);
  const fileRef = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState('');
  const [restoring, setRestoring] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['backups'],
    queryFn: () => doList(),
    refetchInterval: 30_000,
  });

  const generateMutation = useMutation({
    mutationFn: () => doGenerate({ data: { label: label.trim() || undefined } }),
    onSuccess: (res) => {
      toast.success(
        `Backup generated: ${res.stats.training_pairs} pairs, ${res.stats.templates} templates`
      );
      qc.invalidateQueries({ queryKey: ['backups'] });
      setLabel('');
    },
    onError: (e: any) => toast.error('Backup failed: ' + e.message),
  });

  async function handleDownload(id: string, lbl: string) {
    try {
      const { bundle } = await doDownload({ data: { id } });
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `daddyai-backup-${lbl.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Downloaded');
    } catch (e: any) { toast.error(e.message); }
  }

  async function handleRestore(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoring(true);
    try {
      const text = await file.text();
      const bundle = JSON.parse(text);
      const res = await doRestore({ data: { bundle } });
      toast.success(
        `Restored: ${res.restored.training_pairs} pairs, ${res.restored.templates} templates, ${res.restored.rules} rules`
      );
      qc.invalidateQueries({ queryKey: ['backups'] });
    } catch (e: any) { toast.error('Restore failed: ' + e.message); }
    setRestoring(false);
    e.target.value = '';
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      >
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-[#20d878] bg-clip-text text-transparent flex items-center gap-3">
          <Archive className="size-7 text-primary" /> Backup &amp; Restore
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Export training data, templates, voice config &amp; settings.
          Exports auto-push to MCP and are deleted after 24h.
        </p>
      </motion.div>

      {/* Generate */}
      <motion.div
        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: 0.08 }}
        className="bg-card border border-border rounded-2xl p-6 space-y-4"
      >
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 rounded-xl p-2.5 text-primary shrink-0">
            <Database className="size-4" />
          </div>
          <div>
            <h2 className="font-bold text-sm text-foreground">Generate Backup</h2>
            <p className="text-xs text-muted-foreground">
              Training pairs, templates, rules, voice config — one JSON bundle.
              Sent to MCP automatically.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Label (optional)"
            value={label}
            onChange={e => setLabel(e.target.value)}
            className="max-w-xs text-sm"
          />
          <Button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="bg-primary text-[hsl(var(--background))] hover:bg-primary/90 font-bold shadow-[0_0_20px_color-mix(in srgb, var(--primary) 25%, transparent)]"
          >
            {generateMutation.isPending
              ? <><Loader2 className="size-4 mr-2 animate-spin" />Generating…</>
              : <><RefreshCw className="size-4 mr-2" />Generate Now</>
            }
          </Button>
        </div>
      </motion.div>

      {/* Restore */}
      <motion.div
        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: 0.16 }}
        className="bg-card border border-border rounded-2xl p-6 space-y-4"
      >
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 rounded-xl p-2.5 text-primary shrink-0">
            <Upload className="size-4" />
          </div>
          <div>
            <h2 className="font-bold text-sm text-foreground">Restore from File</h2>
            <p className="text-xs text-muted-foreground">
              Upload a .json backup file. Merges with existing data — does not delete anything.
            </p>
          </div>
        </div>
        <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={handleRestore} />
        <Button
          variant="outline"
          onClick={() => fileRef.current?.click()}
          disabled={restoring}
          className="border-primary/30 text-primary hover:bg-primary/5 font-semibold"
        >
          {restoring
            ? <><Loader2 className="size-4 mr-2 animate-spin" />Restoring…</>
            : <><Upload className="size-4 mr-2" />Upload &amp; Restore</>
          }
        </Button>
      </motion.div>

      {/* Export list */}
      <div>
        <h2 className="font-bold text-xs text-muted-foreground uppercase tracking-[0.15em] mb-3">
          Recent Exports
        </h2>
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : !data?.exports?.length ? (
          <div className="text-center py-14 bg-card border border-dashed border-border rounded-2xl">
            <Archive className="size-10 mx-auto text-muted-foreground/25 mb-3" />
            <p className="text-sm text-muted-foreground">No exports yet. Generate one above.</p>
          </div>
        ) : (
          <motion.div variants={containerV} initial="hidden" animate="show" className="space-y-2.5">
            {data.exports.map((exp: any) => {
              const expired = new Date(exp.expires_at) < new Date();
              const expiresIn = Math.max(0, Math.floor((new Date(exp.expires_at).getTime() - Date.now()) / 3_600_000));
              return (
                <motion.div
                  key={exp.id}
                  variants={cardV}
                  className="flex items-center gap-4 bg-card border border-border rounded-xl px-4 py-3"
                >
                  <div className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${expired ? 'bg-muted' : 'bg-primary/10'}`}>
                    {expired
                      ? <Clock className="size-4 text-muted-foreground" />
                      : <CheckCircle2 className="size-4 text-primary" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">{exp.label}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(exp.created_at).toLocaleString()} ·{' '}
                      {expired
                        ? <span className="text-destructive">Expired</span>
                        : <span className="text-primary">{expiresIn}h remaining</span>
                      }
                    </p>
                  </div>
                  <Button
                    size="sm" variant="outline"
                    disabled={expired}
                    onClick={() => handleDownload(exp.id, exp.label)}
                    className="border-primary/30 text-primary hover:bg-primary/5 shrink-0"
                  >
                    <Download className="size-3.5 mr-1.5" /> Download
                  </Button>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-xl px-4 py-3">
        <Shield className="size-3.5 shrink-0" />
        Exports auto-delete after 24 hours and are pushed to your MCP endpoint on generation.
      </div>
    </div>
  );
}
