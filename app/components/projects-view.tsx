"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon, FolderLibraryIcon, Add01Icon } from "@hugeicons/core-free-icons";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useChatContext } from "./chat-provider";

export function ProjectsView() {
  const router = useRouter();
  const { projects, createProject } = useChatContext();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) {
      return projects;
    }
    const query = searchQuery.toLowerCase();
    return projects.filter((project) => {
      return project.name.toLowerCase().includes(query);
    });
  }, [projects, searchQuery]);

  const handleSelectProject = (projectId: string) => {
    router.push(`/projects/${projectId}`);
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;

    const project = await createProject({ name: newProjectName.trim() });
    if (project) {
      setNewProjectName("");
      setIsCreating(false);
      router.push(`/projects/${project.projectId}`);
    }
  };

  return (
    <div className="flex flex-1 flex-col p-8 bg-sidebar dark:bg-background border-l border-border dark:border-l-0">
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">Projects</h1>
          <Button
            onClick={() => setIsCreating(true)}
            variant="outline"
            size="sm"
          >
            <HugeiconsIcon icon={Add01Icon} size={16} className="mr-2" />
            New project
          </Button>
        </div>

        {isCreating && (
          <div className="mb-6 rounded-xl bg-white dark:bg-card p-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreateProject();
              }}
              className="flex gap-2"
            >
              <Input
                type="text"
                placeholder="Project name..."
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                className="flex-1"
                autoFocus
              />
              <Button type="submit" disabled={!newProjectName.trim()}>
                Create
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setIsCreating(false);
                  setNewProjectName("");
                }}
              >
                Cancel
              </Button>
            </form>
          </div>
        )}

        <div className="relative mb-6">
          <HugeiconsIcon icon={Search01Icon} size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 py-6 border-0 focus-visible:ring-0 rounded-xl bg-white dark:bg-card shadow-none"
          />
        </div>

        <div className="rounded-xl bg-white dark:bg-card p-1">
          {filteredProjects.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {searchQuery
                ? "No projects match your search"
                : "No projects yet. Create one to organize your conversations."}
            </p>
          ) : (
            filteredProjects.map((project) => {
              const date = project.createdAt ? new Date(project.createdAt) : null;
              const formattedDate = date
                ? date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
                : "";
              return (
                <button
                  key={project.projectId}
                  onClick={() => handleSelectProject(project.projectId)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 hover:bg-sidebar dark:hover:bg-muted/50 rounded-lg transition-colors text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <HugeiconsIcon icon={FolderLibraryIcon} size={20} className="text-muted-foreground" />
                    <span className="truncate">{project.name}</span>
                  </div>
                  {formattedDate && (
                    <span className="text-sm text-muted-foreground shrink-0">
                      {formattedDate}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
