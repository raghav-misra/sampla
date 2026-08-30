import { useEffect } from "react";
import { useProjects } from "../features/projects/store.js";
import { ProjectView } from "../features/project/ProjectView.js";

export function App() {
  const hydrated = useProjects((s) => s.hydrated);
  const projects = useProjects((s) => s.projects);
  const activeProjectId = useProjects((s) => s.activeProjectId);
  const hydrate = useProjects((s) => s.hydrate);
  const createProject = useProjects((s) => s.createProject);
  const setActiveProject = useProjects((s) => s.setActiveProject);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return (
    <main
      style={{
        fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
        background: "#0a0c11",
        color: "#eef1f6",
        minHeight: "100vh",
        padding: "24px 32px",
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <h1 style={{ margin: 0, fontSize: 22, letterSpacing: 0.5 }}>sampla</h1>
        {hydrated && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
            {projects.length > 0 && (
              <select
                value={activeProjectId ?? ""}
                onChange={(e) => setActiveProject(e.target.value || null)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 4,
                  border: "1px solid #2a2f3a",
                  background: "#0f1115",
                  color: "#eef1f6",
                  fontSize: 12,
                  fontFamily: "inherit",
                }}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={() => void createProject()}
              style={{
                padding: "6px 12px",
                borderRadius: 4,
                border: "1px solid #3a3f4a",
                background: "transparent",
                color: "#eef1f6",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              + New Project
            </button>
          </div>
        )}
      </header>
      {hydrated && projects.length === 0 && (
        <EmptyState onCreate={() => void createProject()} />
      )}
      {hydrated && activeProjectId && <ProjectView />}
    </main>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: 32,
        border: "1px dashed #2a2f3a",
        borderRadius: 8,
        alignItems: "flex-start",
      }}
    >
      <span style={{ color: "#9aa3b2", fontSize: 13 }}>
        No projects yet. Create one to start slicing samples and recording takes.
      </span>
      <button
        type="button"
        onClick={onCreate}
        style={{
          padding: "8px 14px",
          borderRadius: 4,
          border: 0,
          background: "#7bd88f",
          color: "#0f1115",
          fontWeight: 600,
          cursor: "pointer",
          fontSize: 13,
        }}
      >
        Create Project
      </button>
    </div>
  );
}
