"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

export default function MemoriesPage() {
  const router = useRouter();

  return (
    <div className="flex flex-1 flex-col p-8">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6 flex items-center h-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/settings")}
            className="absolute"
          >
            <ChevronLeft className="size-5" />
          </Button>
          <h1 className="text-lg font-semibold w-full text-center">Memories</h1>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl bg-background p-4">
            <p className="text-sm text-muted-foreground">
              No memories yet. The assistant will save important information
              from your conversations here.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
