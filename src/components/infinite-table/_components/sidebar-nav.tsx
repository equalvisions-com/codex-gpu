"use client";

import * as React from "react";

interface SidebarNavProps {
  currentView?: "gpus" | "cpus";
}

export function SidebarNav(_: SidebarNavProps = {}) {
  return <nav className="flex flex-col gap-6" />;
}

export default SidebarNav;
