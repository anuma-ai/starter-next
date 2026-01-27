"use client";

import { use } from "react";
import { AppBuilderView } from "../../../components/app-builder-view";

type Props = {
  params: Promise<{ appId: string }>;
};

export default function AppPage({ params }: Props) {
  const { appId } = use(params);
  return <AppBuilderView appId={appId} />;
}
