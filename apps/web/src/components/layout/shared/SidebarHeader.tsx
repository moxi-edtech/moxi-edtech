export function SidebarHeader({ avatar, title, subtitle, collapsed }: {
  avatar?: React.ReactNode;
  title: string;
  subtitle?: string;
  collapsed?: boolean;
}) {
  return (
    <div className="p-4 flex items-center gap-3">
      {avatar}
      <div className="sidebar-text">
        <div className="font-semibold">{title}</div>
        {subtitle && <div className="text-xs opacity-80">{subtitle}</div>}
      </div>
    </div>
  );
}
