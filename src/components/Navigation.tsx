import React from 'react';
import {
  Home,
  Calendar,
  PlusCircle,
} from 'lucide-react';
import { NavigationTab } from '../types';

interface NavigationProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  onQuickAdd: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentTab,
  onSelectTab,
  onQuickAdd,
}) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-stone-200 shadow-sm">
      <div className="max-w-md mx-auto px-6 py-2 flex items-center justify-center gap-10 sm:gap-14">
        {/* Home Tab */}
        <button
          type="button"
          onClick={() => onSelectTab('home')}
          className={`flex flex-col items-center gap-1 py-1 px-4 rounded-2xl transition-all cursor-pointer ${
            currentTab === 'home'
              ? 'text-emerald-700 font-bold'
              : 'text-stone-400 hover:text-stone-700'
          }`}
          title="홈"
        >
          <Home className={`w-5 h-5 ${currentTab === 'home' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
          <span className="text-[11px]">홈</span>
        </button>

        {/* Center Quick Add Floating Button */}
        <button
          type="button"
          onClick={onQuickAdd}
          className="flex flex-col items-center -mt-5 group cursor-pointer"
          title="저축 기록하기"
        >
          <div className="w-12 h-12 rounded-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white flex items-center justify-center shadow-md shadow-emerald-600/30 transition-all border-2 border-white">
            <PlusCircle className="w-6 h-6" />
          </div>
          <span className="text-[10px] font-bold text-emerald-800 mt-0.5">저축</span>
        </button>

        {/* History Tab */}
        <button
          type="button"
          onClick={() => onSelectTab('history')}
          className={`flex flex-col items-center gap-1 py-1 px-4 rounded-2xl transition-all cursor-pointer ${
            currentTab === 'history'
              ? 'text-emerald-700 font-bold'
              : 'text-stone-400 hover:text-stone-700'
          }`}
          title="히스토리"
        >
          <Calendar className={`w-5 h-5 ${currentTab === 'history' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
          <span className="text-[11px]">히스토리</span>
        </button>
      </div>
    </nav>
  );
};

