import './App.css'

const LEAGUE_NAME = 'Balkanska trkačka liga'
const LEAGUE_NAME_UPPERCASE = 'BALKANSKA TRKAČKA LIGA'

function App() {
  return (
    <main className="landing">
      <h1 className="landing__title">
        {/* The heading text carries the accessible name, so the logo itself is
            decorative. title stays for the desktop hover tooltip. */}
        <img
          className="landing__logo"
          src="/btl-logo-640.jpg"
          srcSet="/btl-logo-640.jpg 640w, /btl-logo-1280.jpg 1280w"
          sizes="(max-width: 900px) 60vw, 520px"
          alt=""
          title={LEAGUE_NAME_UPPERCASE}
          aria-hidden="true"
          width={640}
          height={640}
        />
        <span className="visually-hidden">{LEAGUE_NAME}</span>
      </h1>
      <p className="landing__notice">Portal je u izgradnji</p>
    </main>
  )
}

export default App
