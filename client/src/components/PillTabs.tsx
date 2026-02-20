import { ReactNode } from "react";

interface PillTabsProps {
  tabs: {
    id: string;
    label: string;
    count?: number;
  }[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  children?: ReactNode;
}

export function PillTabs({ tabs, activeTab, onTabChange }: PillTabsProps) {
  return (
    <div className="flex border dark:border-none dark:bg-gray-800 shadow-sm rounded-xl p-1.5 bg-white mb-6">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`
            flex-1 py-[.65rem] cursor-pointer rounded-lg text-center 
            font-semibold text-xs md:text-sm
            transition-all duration-200
            ${
              activeTab === tab.id
                ? "!bg-purple-600 dark:!bg-gray-700 !text-white shadow-sm"
                : "text-gray-500 dark:text-white bg-transparent hover:bg-gray-50 dark:hover:bg-gray-700/50"
            }
          `}
        >
          {tab.label}
          {tab.count !== undefined && ` (${tab.count})`}
        </button>
      ))}
    </div>
  );
}

interface PillTabContentProps {
  value: string;
  activeTab: string;
  children: ReactNode;
}

export function PillTabContent({ value, activeTab, children }: PillTabContentProps) {
  if (value !== activeTab) return null;
  return <div className="animate-in fade-in duration-300">{children}</div>;
}
