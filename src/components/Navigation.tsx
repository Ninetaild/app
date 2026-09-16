import React from 'react';
import { Home, Calendar } from 'lucide-react';
import { NavigationTab } from '../types';

interface NavigationProps { currentTab: NavigationTab; onSelectTab: (tab: NavigationTab) => void; }

export const Navigation: React.FC<NavigationProps> = ({ currentTab, onSelectTab }) => <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-stone-200 shadow-sm">
  <div className="max-w-md mx-auto px-6 py-2 flex items-center justify-center gap-16 sm:gap-24">
    <button type="button" onClick={() => onSelectTab('home')} className={`flex flex-col items-center gap-1 py-1 px-4 rounded-2xl transition-all ${currentTab === 'home' ? 'text-emerald-700 font-bold' : 'text-stone-400 hover:text-stone-700'}`} title="홈">
      <Home className={`w-5 h-5 ${currentTab === 'home' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} /><span className="text-[11px]">홈</span>
    </button>
    <button type="button" onClick={() => onSelectTab('history')} className={`flex flex-col items-center gap-1 py-1 px-4 rounded-2xl transition-all ${currentTab === 'history' ? 'text-emerald-700 font-bold' : 'text-stone-400 hover:text-stone-700'}`} title="히스토리">
      <Calendar className={`w-5 h-5 ${currentTab === 'history' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} /><span className="text-[11px]">히스토리</span>
    </button>
  </div>
</nav>;
