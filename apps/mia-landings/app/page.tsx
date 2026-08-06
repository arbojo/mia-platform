export const dynamic = "force-static";

export default function Home() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
      <h1>MIA Landings</h1>
      <p>Fábrica de landings de MIA Platform — scaffold del monorepo.</p>
      <p style={{ fontSize: "0.85rem", color: "#666" }}>
        @mia/core disponible: verificable en la consola del servidor.
      </p>
    </main>
  );
}
