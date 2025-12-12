"use client";

import { Plus, MessageSquare, LogOut, MoreHorizontal, Trash2 } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type AppSidebarProps = {
  conversations: any[];
  conversationId: string | null;
  onNewConversation: () => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
};

export function AppSidebar({
  conversations,
  conversationId,
  onNewConversation,
  onSelectConversation,
  onDeleteConversation,
}: AppSidebarProps) {
  const { authenticated, user, login, logout, ready } = usePrivy();

  return (
    <Sidebar>
      <SidebarHeader>
        <Button onClick={onNewConversation} className="w-full gap-2">
          <Plus className="size-4" />
          New Chat
        </Button>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {conversations.map((conv: any, index: number) => (
                <SidebarMenuItem key={conv.id ?? index}>
                  <SidebarMenuButton
                    isActive={conversationId === conv.id}
                    onClick={() => onSelectConversation(conv.id)}
                  >
                    <MessageSquare className="size-4" />
                    <span className="truncate">
                      {conv.title || `Chat ${conv.id?.slice(0, 8) ?? index + 1}`}
                    </span>
                  </SidebarMenuButton>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <SidebarMenuAction showOnHover>
                        <MoreHorizontal className="size-4" />
                      </SidebarMenuAction>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" align="start">
                      <DropdownMenuItem
                        onClick={() => onDeleteConversation(conv.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 size-4 text-destructive" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </SidebarMenuItem>
              ))}
              {conversations.length === 0 && (
                <p className="px-2 py-2 text-sm text-muted-foreground">
                  No conversations yet
                </p>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        {!ready ? (
          <Button disabled className="w-full">
            Loading...
          </Button>
        ) : authenticated ? (
          <div className="flex flex-col gap-2">
            <span className="truncate px-2 text-sm text-muted-foreground">
              {user?.email?.address ?? user?.id ?? "Signed in"}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => logout()}
              className="w-full justify-start gap-2"
            >
              <LogOut className="size-4" />
              Sign out
            </Button>
          </div>
        ) : (
          <Button onClick={() => login()} className="w-full">
            Sign in
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
