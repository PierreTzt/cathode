import { afterEach } from "vitest";

// Les tests de composants montent dans un DOM (happy-dom) ; on le vide entre
// chaque cas pour éviter que les rendus se marchent dessus. En environnement
// Node (la majorité de la suite), il n'y a pas de document : on ne fait rien.
afterEach(async () => {
  if (typeof document === "undefined") return;
  const { cleanup } = await import("@testing-library/react");
  cleanup();
});
