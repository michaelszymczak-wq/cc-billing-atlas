import React, { useState } from 'react';

interface Tab {
  id: string;
  label: string;
  badge?: number;
  content: React.ReactNode;
}

interface TabViewProps {
  tabs: Tab[];
}

export default function TabView({ tabs }: TabViewProps) {
  const [activeTab, setActiveTab] = useState(tabs[0]?.id || '');

  const active = tabs.find((t) => t.id === activeTab);

  return (
    <div>
      <div className="border-b border-gray-200">
        <nav className="flex gap-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-violet-500 text-violet-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-200 text-gray-600">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>
      <div className="pt-4">{active?.content}</div>
    </div>
  );
}
