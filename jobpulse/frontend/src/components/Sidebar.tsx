/*
this file handles:
    - desktop sidebar and mobile bottom nav bar
    - highlights the active route and log out control
*/


"use client";


import Link from "next/link";
import { usePathname } from "next/navigation";
import {LayoutDashboard, ClipboardList, CalendarDays, Settings, LogOut, Zap} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";


//define navigation
const NAV_ITEMS = [
    {href: "/dashboard", label: "Dashboard", icon: LayoutDashboard},
    {href: "/applications", label: "Applications", icon: ClipboardList},
    {href: "/history", label: "History", icon: CalendarDays},
    {href: "/settings", label: "Settings", icon: Settings},
] as const;

function isActiveRoute(pathname: string, href: string) {
    return pathname === href || pathname.startsWith(href + "/");
}

export default function Sidebar() {

    const pathname = usePathname();
    const {user, logout, isLoading} = useAuth();


  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="fixed inset-y-0 left-0 z-50 hidden w-64 flex-col
                   border-r border-gray-800 bg-gray-900 md:flex"
      >
        {/* App branding */}
        <div className="flex h-16 items-center gap-2 border-b border-gray-800 px-6">
          <Zap className="h-6 w-6 text-amber-400" />
          <span className="text-lg font-bold text-white">JobPulse</span>
        </div>

        {/* Primary navigation */}
        <nav className="flex flex-1 flex-col gap-1 p-4">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActiveRoute(pathname, href)
                  ? "bg-gray-800 text-white"
                  : "text-gray-400 hover:bg-gray-800/50 hover:text-white"
              )}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        {/* Current user info + logout */}
        <div className="border-t border-gray-800 p-4">
          {user && (
            <div className="mb-3 flex items-center gap-3 px-1">
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.name}
                  className="h-8 w-8 rounded-full"
                />
              ) : (
                <div
                  className="flex h-8 w-8 items-center justify-center
                             rounded-full bg-gray-700 text-sm font-medium"
                >
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}

              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">
                  {user.name}
                </p>

                <p className="truncate text-xs text-gray-500">
                  {user.email}
                </p>
              </div>
            </div>
          )}

          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2
                       text-sm font-medium text-gray-400 transition-colors
                       hover:bg-gray-800/50 hover:text-white"
          >
            <LogOut className="h-5 w-5" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile bottom navigation */}
      <nav
        className="fixed inset-x-0 bottom-0 z-50 flex border-t
                   border-gray-800 bg-gray-900 md:hidden"
      >
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium transition-colors",
              isActiveRoute(pathname, href)
                ? "text-white"
                : "text-gray-500 hover:text-gray-300"
            )}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}