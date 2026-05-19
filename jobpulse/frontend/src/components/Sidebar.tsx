/*
this file handles:
    - desktop sidebar and mobile bottom nav bar
    - highlights the active route and log out control
*/


"use client";


import Link from "next/link";
import { usePathname } from "next/navigation";
import {LayoutDashboard, ClipboardList, CalendarHeatmap, Settings, LogOut, Zap, Icon} from "lucide-react";


//define navigation
const NAV_ITEMS = [
    {href: "/dashboard", label: "Dashboard", icon: LayoutDashboard},
    {href: "/applications", label: "Applications", icon: ClipboardList},
    {href: "/history", label: "History", icon: CalendarHeatmap},
    {href: "/settings", label: "Settings", Icon: Settings},
] as const;


