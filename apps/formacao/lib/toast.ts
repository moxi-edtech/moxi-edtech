// Simulação básica de toast para cumprir o requisito
export function toast({ title, description, variant }: { title: string, description?: string, variant?: "default" | "destructive" }) {
  const message = `${title}${description ? `
${description}` : ""}`;
  if (variant === "destructive") {
    console.error("TOAST ERROR:", message);
    window.alert("❌ " + message);
  } else {
    console.log("TOAST SUCCESS:", message);
    window.alert("✅ " + message);
  }
}
