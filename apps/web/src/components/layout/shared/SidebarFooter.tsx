export function SidebarFooter({ collapsed, children }: { collapsed?: boolean; children?: React.ReactNode }) {
  return (
    <div className="p-4 border-t border-white/10 sidebar-footer">
      {children}
    </div>
  );
}
