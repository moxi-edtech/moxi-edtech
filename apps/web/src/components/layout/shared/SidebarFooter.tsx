export function SidebarFooter({ collapsed, children }: { collapsed?: boolean; children?: React.ReactNode }) {
  return (
    <div className="shrink-0 min-w-0 overflow-hidden p-4 border-t border-sidebar-border sidebar-footer">
      {children}
    </div>
  );
}
