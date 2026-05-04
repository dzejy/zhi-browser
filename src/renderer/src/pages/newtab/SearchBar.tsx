import React, { useEffect, useRef, useState } from 'react'
import type { Engine } from './defaultEngines'

interface SearchBarProps {
  currentEngine: Engine
  engines: Engine[]
  onSearch: (url: string) => void
  onChangeEngine: (engine: Engine) => void
  onManageEngines: () => void
  onFocusToggle: () => void
}

export const SearchBar: React.FC<SearchBarProps> = ({
  currentEngine,
  engines,
  onSearch,
  onChangeEngine,
  onManageEngines,
  onFocusToggle
}) => {
  const [timeStr, setTimeStr] = useState('00:00:00')
  const [dateStr, setDateStr] = useState('')
  const [query, setQuery] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const selectorRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const updateDateTime = (): void => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');
      setTimeStr(`${h}:${m}:${s}`);

      const y = now.getFullYear();
      const mo = now.getMonth() + 1;
      const d = now.getDate();
      const weeks = ['日', '一', '二', '三', '四', '五', '六'];
      const w = weeks[now.getDay()];
      setDateStr(`${y}年${mo}月${d}日 星期${w}`);
    };
    updateDateTime();
    const interval = setInterval(updateDateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent): void => {
      if (
        isDropdownOpen && 
        dropdownRef.current && 
        !dropdownRef.current.contains(e.target as Node) &&
        selectorRef.current &&
        !selectorRef.current.contains(e.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isDropdownOpen]);

  const handleSearch = (): void => {
    if (!query.trim()) return;
    const url = currentEngine.url + encodeURIComponent(query.trim());
    onSearch(url);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') handleSearch();
  };

  return (
    <div className="search-section" id="searchSection">
      <div className="datetime-display" id="datetimeDisplay">
        <div className="time">{timeStr}</div>
        <div className="date">{dateStr}</div>
      </div>

      <div className="search-container" id="searchContainer">
        <button className="z-btn" title="专注模式" onClick={onFocusToggle}>
          Z
        </button>
        <div className="search-bar-wrapper" id="searchBarWrapper">
          <div className="search-input-row">
            <input
              type="text"
              className="search-input"
              placeholder="搜索你想要的内容..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="off"
            />
            <div style={{ position: 'relative', display: 'flex' }}>
              <button
                ref={selectorRef}
                className={`engine-selector ${isDropdownOpen ? 'open' : ''}`}
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              >
                <span>{currentEngine.name}</span>
                <span className="arrow">▾</span>
              </button>
              <div ref={dropdownRef} className={`engine-dropdown ${isDropdownOpen ? 'show' : ''}`}>
                <div className="engine-grid">
                  {engines.slice(0, 8).map((eng) => (
                    <button
                      key={eng.name}
                      className={`engine-item ${eng.name === currentEngine.name ? 'active' : ''}`}
                      onClick={() => {
                        onChangeEngine(eng)
                        setIsDropdownOpen(false)
                      }}
                    >
                      {eng.name}
                    </button>
                  ))}
                  <button
                    className="engine-item manage-btn"
                    onClick={() => {
                      setIsDropdownOpen(false)
                      onManageEngines()
                    }}
                  >
                    设置/管理
                  </button>
                </div>
              </div>
            </div>
            <button className="search-btn" title="搜索" onClick={handleSearch}>
              <svg viewBox="0 0 24 24">
                <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
