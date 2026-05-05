import React, { useState, useRef } from 'react';
import './newtab.css';
import './newtab.elegant.css';
import { DEFAULT_CATEGORIES, Category } from './defaultLinks';
import { DEFAULT_ENGINES, Engine } from './defaultEngines';
import { SnowCanvas, SnowCanvasHandle } from './SnowCanvas';
import { SearchBar } from './SearchBar';
import { NavGrid } from './NavGrid';
import { SettingsDrawer } from './SettingsDrawer';
import { EditDialog } from './EditDialog';

const STORAGE_KEY = 'zhi-nav-links';
const ENGINES_KEY = 'zhi-nav-engines';

interface NewTabPageProps {
  onNavigate: (url: string) => void;
}

export const NewTabPage: React.FC<NewTabPageProps> = ({ onNavigate }) => {
  const [categories, setCategories] = useState<Category[]>(() => {
    try {
      const savedCat = localStorage.getItem(STORAGE_KEY);
      return savedCat ? JSON.parse(savedCat) : JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
    } catch {
      return JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
    }
  });
  const [engines, setEngines] = useState<Engine[]>(() => {
    try {
      const savedEng = localStorage.getItem(ENGINES_KEY);
      return savedEng ? JSON.parse(savedEng) : JSON.parse(JSON.stringify(DEFAULT_ENGINES));
    } catch {
      return JSON.parse(JSON.stringify(DEFAULT_ENGINES));
    }
  });
  const [currentEngine, setCurrentEngine] = useState<Engine>(() => {
    try {
      const savedEng = localStorage.getItem(ENGINES_KEY);
      if (savedEng) {
        const parsed = JSON.parse(savedEng);
        if (parsed.length > 0) return parsed[0];
      }
      return DEFAULT_ENGINES[0];
    } catch {
      return DEFAULT_ENGINES[0];
    }
  });
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [snowMode, setSnowMode] = useState(() => localStorage.getItem('zhi-snow-mode') || 'extreme');
  const [snowPaused, setSnowPaused] = useState(() => localStorage.getItem('zhi-snow-paused') === 'true');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const [dialogType, setDialogType] = useState<'none' | 'link' | 'category' | 'engines'>('none');
  const [editTarget, setEditTarget] = useState<{ catIdx: number; linkIdx: number | null } | null>(null);

  const snowRef = useRef<SnowCanvasHandle>(null);

  const saveCategories = (cats: Category[]): void => {
    setCategories(cats);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cats));
  };

  const saveEngines = (engs: Engine[]): void => {
    const finalEngs = engs.length > 0 ? engs : JSON.parse(JSON.stringify(DEFAULT_ENGINES));
    setEngines(finalEngs);
    localStorage.setItem(ENGINES_KEY, JSON.stringify(finalEngs));
    if (!finalEngs.find(e => e.name === currentEngine.name)) {
      setCurrentEngine(finalEngs[0]);
    }
  };

  const handleFocusToggle = (): void => {
    setIsFocusMode(!isFocusMode);
    if (snowRef.current) snowRef.current.triggerSnowBurst();
  };

  return (
    <div className={`newtab-page ${isFocusMode ? 'focus-mode' : ''} ${isEditMode ? 'edit-mode' : ''}`}>
      <div className="bg-layer"></div>
      <div className="bg-overlay"></div>
      <SnowCanvas 
        ref={snowRef}
        snowAccumMode={snowMode}
        isFocusMode={isFocusMode}
        isPaused={snowPaused}
      />
      
      <div className="main-container">
        <button className="settings-btn" title="设置" onClick={() => setIsSettingsOpen(true)}>
          <svg viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.488.488 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 00-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1115.6 12 3.611 3.611 0 0112 15.6z"/></svg>
        </button>

        <SearchBar 
          currentEngine={currentEngine}
          engines={engines}
          onSearch={onNavigate}
          onChangeEngine={setCurrentEngine}
          onManageEngines={() => setDialogType('engines')}
          onFocusToggle={handleFocusToggle}
        />

        <NavGrid 
          categories={categories}
          isEditMode={isEditMode}
          onNavigate={onNavigate}
          onEditCategory={(ci) => {
            setEditTarget({ catIdx: ci, linkIdx: null });
            setDialogType('category');
          }}
          onEditLink={(ci, li) => {
            setEditTarget({ catIdx: ci, linkIdx: li });
            setDialogType('link');
          }}
        />
      </div>

      <div className="footer-left">Tips：雪太多的时候点击Z清理雪吧</div>
      <div className="footer-center">@Dzejy — 2026 — Zhi导航</div>
      <div className="footer-right">孤舟蓑笠翁，独钓寒江雪。</div>

      <SettingsDrawer 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        isEditMode={isEditMode}
        onEditModeChange={setIsEditMode}
        snowMode={snowMode}
        onSnowModeChange={(val) => {
          setSnowMode(val);
          localStorage.setItem('zhi-snow-mode', val);
        }}
        snowPaused={snowPaused}
        onSnowPausedChange={(val) => {
          setSnowPaused(val);
          localStorage.setItem('zhi-snow-paused', String(val));
        }}
        onResetAll={() => {
          if (confirm('确定恢复所有链接为默认值？自定义内容将丢失。')) {
            saveCategories(JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)));
            setIsSettingsOpen(false);
          }
        }}
      />

      <EditDialog 
        type={dialogType}
        isOpen={dialogType !== 'none'}
        onClose={() => setDialogType('none')}
        initialName={
          dialogType === 'category' && editTarget 
            ? categories[editTarget.catIdx].name 
            : dialogType === 'link' && editTarget && editTarget.linkIdx !== null
            ? categories[editTarget.catIdx].links[editTarget.linkIdx].name
            : ''
        }
        initialUrl={
          dialogType === 'link' && editTarget && editTarget.linkIdx !== null
            ? categories[editTarget.catIdx].links[editTarget.linkIdx].url
            : ''
        }
        onSaveCategory={(name) => {
          if (name && editTarget) {
            const newCats = [...categories];
            newCats[editTarget.catIdx].name = name;
            saveCategories(newCats);
          }
          setDialogType('none');
        }}
        onSaveLink={(name, url) => {
          if (name && url && editTarget && editTarget.linkIdx !== null) {
            const newCats = [...categories];
            newCats[editTarget.catIdx].links[editTarget.linkIdx] = { name, url };
            saveCategories(newCats);
          }
          setDialogType('none');
        }}
        onResetLink={() => {
          if (editTarget) {
            const newCats = [...categories];
            if (editTarget.linkIdx === null) {
              newCats[editTarget.catIdx].name = DEFAULT_CATEGORIES[editTarget.catIdx].name;
            } else {
              newCats[editTarget.catIdx].links[editTarget.linkIdx] = { ...DEFAULT_CATEGORIES[editTarget.catIdx].links[editTarget.linkIdx] };
            }
            saveCategories(newCats);
          }
          setDialogType('none');
        }}
        engines={engines}
        onSaveEngines={(newEngs) => {
          saveEngines(newEngs);
          setDialogType('none');
        }}
        onResetEngines={() => {
          saveEngines(JSON.parse(JSON.stringify(DEFAULT_ENGINES)));
        }}
      />
    </div>
  );
};
