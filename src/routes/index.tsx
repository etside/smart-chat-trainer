import { createFileRoute } from "@tanstack/react-router";

import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { session } = useAuth();
  return <div>Session: {session ? "logged in" : "logged out"}</div>;
}