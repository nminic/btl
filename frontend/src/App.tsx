import './App.css'

const LEAGUE_NAME = 'BALKANSKA TRKAČKA LIGA'

function App() {
  return (
    <main className="landing">
      <img
        className="landing__logo"
        src="/btl-logo.jpg"
        alt={LEAGUE_NAME}
        title={LEAGUE_NAME}
        width={2000}
        height={2000}
      />
      <p className="landing__notice">Portal je u izgradnji</p>
    </main>
  )
}

export default App
