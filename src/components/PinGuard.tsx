'use client';
/**
 * PinGuard.tsx
 * Wraps the admin panel with a PIN / biometric lock screen.
 *
 * PIN: 856777 (stored in agent_settings.admin_pin — changeable from settings)
 * Biometric: WebAuthn platform authenticator (Face ID / fingerprint)
 *
 * Session is stored in sessionStorage so the lock resets on tab close.
 * Unlock duration: 4 hours (configurable via UNLOCK_DURATION_MS)
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Fingerprint, Delete, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const UNLOCK_DURATION_MS = 4 * 60 * 60 * 1000; // 4 hours
const SESSION_KEY = 'daddyai_pin_unlocked';
const CORRECT_PIN_FALLBACK = '856777'; // fallback if DB fetch fails

// ── Fetch actual PIN from DB via server fn ─────────────────────────────────
async function fetchAdminPin(): Promise<string> {
  try {
    const res = await fetch('/api/admin/pin-check', { method: 'GET' });
    if (!res.ok) return CORRECT_PIN_FALLBACK;
    const data = await res.json();
    return data.pin ?? CORRECT_PIN_FALLBACK;
  } catch {
    return CORRECT_PIN_FALLBACK;
  }
}

// ── Check session storage ─────────────────────────────────────────────────
function isSessionUnlocked(): boolean {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    const { until } = JSON.parse(raw);
    return Date.now() < until;
  } catch {
    return false;
  }
}

function setSessionUnlocked() {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ until: Date.now() + UNLOCK_DURATION_MS }));
}

function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

// ── WebAuthn biometric ─────────────────────────────────────────────────────
async function registerAndAuthBiometric(): Promise<boolean> {
  if (!window.PublicKeyCredential) return false;
  try {
    // Check if platform authenticator available
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    if (!available) return false;

    const storedCred = sessionStorage.getItem('daddyai_webauthn_cred');

    if (storedCred) {
      // Authenticate with existing credential
      const credId = Uint8Array.from(atob(storedCred), c => c.charCodeAt(0));
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          allowCredentials: [{ id: credId, type: 'public-key' }],
          userVerification: 'required',
          timeout: 60000,
        },
      });
      return !!assertion;
    } else {
      // Register new credential
      const cred = await navigator.credentials.create({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: { name: 'DaddyAI Admin', id: window.location.hostname },
          user: {
            id: new TextEncoder().encode('daddyai-admin'),
            name: 'admin@daddyai',
            displayName: 'DaddyAI Admin',
          },
          pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
          },
          timeout: 60000,
        },
      }) as PublicKeyCredential | null;

      if (!cred) return false;
      // Store credential ID for future use
      const credIdB64 = btoa(String.fromCharCode(...new Uint8Array(cred.rawId)));
      sessionStorage.setItem('daddyai_webauthn_cred', credIdB64);
      return true;
    }
  } catch (err: any) {
    // User cancelled or not supported
    console.warn('[PinGuard] biometric error:', err.message);
    return false;
  }
}

// ── PIN pad button ─────────────────────────────────────────────────────────
function PadBtn({ label, onClick }: { label: string | React.ReactNode; onClick: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.88 }}
      onClick={onClick}
      className="flex items-center justify-center w-16 h-16 rounded-2xl bg-card border border-border text-xl font-semibold hover:bg-accent hover:border-primary/30 active:bg-primary/10 transition-all duration-150 select-none"
    >
      {label}
    </motion.button>
  );
}

// ── Main PinGuard ──────────────────────────────────────────────────────────
interface PinGuardProps {
  children: React.ReactNode;
}

export function PinGuard({ children }: PinGuardProps) {
  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const [pin, setPin] = useState('');
  const [correctPin, setCorrectPin] = useState(CORRECT_PIN_FALLBACK);
  const [status, setStatus] = useState<'idle' | 'error' | 'success' | 'biometric'>('idle');
  const [bioAvailable, setBioAvailable] = useState(false);
  const shakeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check session + fetch PIN
  useEffect(() => {
    if (isSessionUnlocked()) {
      setUnlocked(true);
      setChecking(false);
      return;
    }
    fetchAdminPin().then(p => {
      setCorrectPin(p);
      setChecking(false);
    });
    // Check biometric availability
    if (window.PublicKeyCredential) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then(setBioAvailable)
        .catch(() => setBioAvailable(false));
    }
  }, []);

  // Auto-check PIN when 6 digits entered
  useEffect(() => {
    if (pin.length !== 6) return;
    if (pin === correctPin) {
      setStatus('success');
      setTimeout(() => {
        setSessionUnlocked();
        setUnlocked(true);
      }, 600);
    } else {
      setStatus('error');
      if (shakeRef.current) clearTimeout(shakeRef.current);
      shakeRef.current = setTimeout(() => {
        setPin('');
        setStatus('idle');
      }, 800);
    }
  }, [pin, correctPin]);

  const pressDigit = useCallback((d: string) => {
    if (status === 'error' || status === 'success') return;
    setPin(prev => prev.length < 6 ? prev + d : prev);
  }, [status]);

  const pressDelete = useCallback(() => {
    if (status === 'error' || status === 'success') return;
    setPin(prev => prev.slice(0, -1));
  }, [status]);

  const pressBiometric = useCallback(async () => {
    setStatus('biometric');
    const ok = await registerAndAuthBiometric();
    if (ok) {
      setStatus('success');
      setTimeout(() => {
        setSessionUnlocked();
        setUnlocked(true);
      }, 600);
    } else {
      setStatus('idle');
    }
  }, []);

  const lock = useCallback(() => {
    clearSession();
    setUnlocked(false);
    setPin('');
    setStatus('idle');
  }, []);

  // Expose lock fn globally for use in admin layout
  useEffect(() => {
    (window as any).__daddyaiLock = lock;
    return () => { delete (window as any).__daddyaiLock; };
  }, [lock]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (unlocked) {
    return <>{children}</>;
  }

  // ── Lock screen ──────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen items-center justify-center bg-background relative overflow-hidden">
      {/* Background effects */}
      <div className="pointer-events-none absolute inset-0 sd-grid-bg opacity-40" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-primary/8 blur-[120px]" />
      <div className="sd-noise-overlay absolute inset-0 pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-sm px-4"
      >
        <div className="rounded-3xl border border-border bg-card/80 backdrop-blur-2xl p-8 shadow-2xl text-center">
          {/* Logo */}
          <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/25">
            <Bot className="size-7" strokeWidth={2.5} />
          </div>

          <h1 className="text-xl font-bold tracking-tight">
            Daddy<span className="sd-gradient-text">AI</span> Admin
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Enter PIN to unlock</p>

          {/* PIN dots */}
          <motion.div
            animate={status === 'error' ? { x: [-8, 8, -6, 6, -3, 3, 0] } : {}}
            transition={{ duration: 0.4 }}
            className="mt-8 flex justify-center gap-3"
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <motion.div
                key={i}
                animate={{
                  scale: i < pin.length ? [1, 1.3, 1] : 1,
                  backgroundColor: status === 'error'
                    ? 'hsl(0 72% 51%)'
                    : status === 'success'
                      ? 'hsl(100 86% 58%)'
                      : i < pin.length
                        ? 'hsl(100 86% 58%)'
                        : 'hsl(var(--border))',
                }}
                transition={{ duration: 0.2 }}
                className="size-3.5 rounded-full border border-border"
              />
            ))}
          </motion.div>

          {/* Status message */}
          <AnimatePresence mode="wait">
            {status === 'error' && (
              <motion.p
                key="err"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-3 text-xs text-destructive flex items-center justify-center gap-1.5"
              >
                <XCircle className="size-3.5" /> Incorrect PIN
              </motion.p>
            )}
            {status === 'success' && (
              <motion.p
                key="ok"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 text-xs text-primary flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="size-3.5" /> Unlocked!
              </motion.p>
            )}
            {status === 'biometric' && (
              <motion.p
                key="bio"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 text-xs text-muted-foreground flex items-center justify-center gap-1.5"
              >
                <Loader2 className="size-3.5 animate-spin" /> Verifying...
              </motion.p>
            )}
            {status === 'idle' && pin.length === 0 && (
              <p key="hint" className="mt-3 text-xs text-transparent select-none">.</p>
            )}
          </AnimatePresence>

          {/* PIN pad */}
          <div className="mt-6 grid grid-cols-3 gap-3 justify-items-center">
            {['1','2','3','4','5','6','7','8','9'].map(d => (
              <PadBtn key={d} label={d} onClick={() => pressDigit(d)} />
            ))}
            {/* Biometric or empty */}
            {bioAvailable ? (
              <PadBtn
                label={<Fingerprint className="size-6 text-primary" />}
                onClick={pressBiometric}
              />
            ) : (
              <div className="w-16 h-16" />
            )}
            <PadBtn label="0" onClick={() => pressDigit('0')} />
            <PadBtn
              label={<Delete className="size-5 text-muted-foreground" />}
              onClick={pressDelete}
            />
          </div>

          {/* Biometric full button if available */}
          {bioAvailable && (
            <Button
              variant="outline"
              className="mt-5 w-full rounded-xl gap-2 text-sm"
              onClick={pressBiometric}
              disabled={status === 'biometric'}
            >
              <Fingerprint className="size-4 text-primary" />
              Use biometric (Face ID / fingerprint)
            </Button>
          )}

          <p className="mt-5 text-[10px] text-muted-foreground/50">
            DaddyAI Admin · Secured
          </p>
        </div>
      </motion.div>
    </div>
  );
}
