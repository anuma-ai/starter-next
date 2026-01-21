"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import {
  QuillWrite02Icon,
  MoreHorizontalIcon,
  Delete01Icon,
  Setting07Icon,
  Search01Icon,
  Folder01Icon,
} from "@hugeicons/core-free-icons";
import { usePrivy } from "@privy-io/react-auth";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
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
  currentView: "chat" | "settings" | "conversations" | "files";
  onViewChange: (view: "chat" | "settings" | "conversations" | "files") => void;
};

export function AppSidebar({
  conversations,
  conversationId,
  onNewConversation,
  onSelectConversation,
  onDeleteConversation,
  currentView,
  onViewChange,
}: AppSidebarProps) {
  const { authenticated, login, ready } = usePrivy();

  return (
    <Sidebar>
      {authenticated && (
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={onNewConversation}>
                <HugeiconsIcon icon={QuillWrite02Icon} size={16} />
                <span>New chat</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={currentView === "conversations"}
                onClick={() => onViewChange("conversations")}
              >
                <HugeiconsIcon icon={Search01Icon} size={16} />
                <span>Search</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={currentView === "files"}
                onClick={() => onViewChange("files")}
              >
                <HugeiconsIcon icon={Folder01Icon} size={16} />
                <span>Files</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
      )}

      {authenticated && (
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel className="text-muted-foreground">
              Conversations
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {conversations.slice(0, 10).map((conv: any, index: number) => (
                  <SidebarMenuItem key={conv.id ?? index}>
                    <SidebarMenuButton
                      isActive={
                        currentView === "chat" && conversationId === conv.id
                      }
                      onClick={() => onSelectConversation(conv.id)}
                    >
                      <span className="truncate">
                        {conv.title ||
                          `Chat ${conv.id?.slice(0, 8) ?? index + 1}`}
                      </span>
                    </SidebarMenuButton>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <SidebarMenuAction
                          showOnHover
                          className="!w-7 !h-7 !top-1/2 !-translate-y-1/2 rounded-full hover:bg-muted flex items-center justify-center cursor-pointer"
                        >
                          <HugeiconsIcon icon={MoreHorizontalIcon} size={16} />
                        </SidebarMenuAction>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="right" align="start">
                        <DropdownMenuItem
                          onClick={() => onDeleteConversation(conv.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <HugeiconsIcon
                            icon={Delete01Icon}
                            size={16}
                            className="mr-2 text-destructive"
                          />
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
      )}

      <SidebarFooter>
        {authenticated && (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={currentView === "settings"}
                onClick={() => onViewChange("settings")}
              >
                <HugeiconsIcon icon={Setting07Icon} size={16} />
                <span>Settings</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
        {!ready ? (
          <Button disabled className="w-full">
            Loading...
          </Button>
        ) : !authenticated ? (
          <Button onClick={() => login()} className="w-full">
            Sign in
          </Button>
        ) : null}
      </SidebarFooter>
    </Sidebar>
  );
}
