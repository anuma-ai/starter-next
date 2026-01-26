"use client";

import { use } from "react";
import { ProjectDetailView } from "../../../components/project-detail-view";

type Props = {
  params: Promise<{ projectId: string }>;
};

export default function ProjectPage({ params }: Props) {
  const { projectId } = use(params);
  return <ProjectDetailView projectId={projectId} />;
}
