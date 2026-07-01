"use client"

import DockMorph from "@/components/ui/dock-morph"
import { Home, Search, Bell, User, Settings } from "lucide-react"

export default function DemoOne() {
  const items = [
    { icon: Home, label: "Home", onClick: () => alert("Home clicked") },
    { icon: Search, label: "Search", onClick: () => alert("Search clicked") },
    { icon: Bell, label: "Notifications", onClick: () => alert("Notifications clicked") },
    { icon: User, label: "Profile", onClick: () => alert("Profile clicked") },
    { icon: Settings, label: "Settings", onClick: () => alert("Settings clicked") },
  ]

//<DockMorph position="bottom" />
// <DockMorph position="top" />
// <DockMorph position="left" />

  return <DockMorph />
}
