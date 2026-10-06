// /projects/lander/components/WidgetCard.tsx
"use client";

import React from 'react';

interface WidgetCardProps {
  title: string;
  children: React.ReactNode;
  iconUrl?: string;
  className?: string;
}

export default function WidgetCard({
  title,
  children,
  iconUrl,
  className = "",
}: WidgetCardProps) {
  return (
    <div className={`p-6 rounded-xl shadow-lg border transition-colors duration-300 bg-white dark:bg-gray-800 border-zinc-200 dark:border-zinc-700 ${className}`}>
      {iconUrl && (
        <img src={iconUrl} alt={`${title} icon`} className="h-10 w-10 mb-4" />
      )}
      <h2 className="text-xl font-semibold mb-4 text-indigo-500">{title}</h2>
      <div>
        {children}
      </div>
    </div>
  );
}