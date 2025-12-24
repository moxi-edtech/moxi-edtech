import Link from "next/link";
import { ChevronRight } from "lucide-react";
import React from 'react';

type Breadcrumb = {
  label: string;
  href?: string;
};

type DashboardHeaderProps = {
  title: string;
  description?: string;
  breadcrumbs?: Breadcrumb[];
  actions?: React.ReactNode;
};

export function DashboardHeader({
  title,
  description,
  breadcrumbs,
  actions,
}: DashboardHeaderProps) {
  return (
    <div className="space-y-2">
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1 text-xs text-slate-400">
          {breadcrumbs.map((bc, idx) => (
            <span key={idx} className="flex items-center gap-1">
              {bc.href ? (
                <Link
                  href={bc.href}
                  className="hover:text-slate-600 transition"
                >
                  {bc.label}
                </Link>
              ) : (
                <span className="text-slate-500">{bc.label}</span>
              )}
              {idx < breadcrumbs.length - 1 && (
                <ChevronRight className="h-3 w-3" />
              )}
            </span>
          ))}
        </nav>
      )}

      {/* Title + Actions */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
            {title}
          </h1>
          {description && (
            <p className="mt-0.5 text-sm text-slate-500">
              {description}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex items-center gap-2">{actions}</div>
        )}
      </div>
    </div>
  );
}
