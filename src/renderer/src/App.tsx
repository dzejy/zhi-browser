function App(): React.JSX.Element {
  return (
    <div className="browser-shell">
      <header className="browser-header">
        <div className="tab-bar" aria-label="Tab bar placeholder">
          <div className="tab is-active">New Tab</div>
          <button className="new-tab-button" type="button" title="New tab placeholder">
            +
          </button>
        </div>

        <div className="toolbar">
          <button className="nav-button" type="button" title="Back">
            Back
          </button>
          <button className="nav-button" type="button" title="Forward">
            Forward
          </button>
          <button className="nav-button" type="button" title="Refresh">
            Refresh
          </button>
          <input
            className="address-input"
            type="text"
            placeholder="Search or enter address"
            aria-label="Address bar placeholder"
          />
        </div>
      </header>

      <main className="welcome-page">
        <h1>Zhi Browser</h1>
      </main>
    </div>
  )
}

export default App
