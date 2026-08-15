export {}

/* What the build is given to reach the two measurement systems with.
 *
 * All three are read at build time by Vite and are absent everywhere but
 * production (ADL A9: „lokalno i staging ne šalju podatke"), so every one of
 * them is optional and the code has to be written for their absence rather than
 * asserting them present, which ADL A14 bans.
 *
 * Google's own queue on the window is not declared here. It belongs to a script
 * this portal loads on one condition and usually never loads at all, so it is
 * not a fact about every window in the application; `Analytics.tsx` reaches it
 * through a typed view of the window instead.
 */
declare global {
  interface ImportMetaEnv {
    /** The GA4 measurement id, and not the tag id: ADL A9 records that GA reuses
     *  an existing tag for a new stream, so `gtag/js?id=<measurement id>` can
     *  answer 404 in silence. The value is the one GA prints under „Install
     *  manually", in the `gtag/js?id=` line itself. */
    readonly VITE_GA_MEASUREMENT_ID?: string
    /** Where the self-hosted Umami script is served from. */
    readonly VITE_UMAMI_SRC?: string
    /** Which site Umami reports this one as. */
    readonly VITE_UMAMI_WEBSITE_ID?: string
  }
}
