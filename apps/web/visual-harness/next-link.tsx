import React from "react";
export default function FixtureLink({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return <a href={typeof href === "string" ? href : "#"} {...props}>{children}</a>;
}
