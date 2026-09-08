import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/routes/__root";
import { motion } from "framer-motion";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggle } = useTheme();

  return (
    <motion.button
      whileTap={{ scale: 0.88 }}
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      className={`relative inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-card/60 text-muted-foreground transition-all duration-200 hover:bg-accent hover:text-foreground hover:border-primary/30 ${className}`}
    >
      <motion.div
        key={theme}
        initial={{ opacity: 0, rotate: -90, scale: 0.6 }}
        animate={{ opacity: 1, rotate: 0, scale: 1 }}
        exit={{ opacity: 0, rotate: 90, scale: 0.6 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      >
        {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </motion.div>
    </motion.button>
  );
}
