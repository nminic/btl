/**
 * EVERY STYLESHEET THE PORTAL'S CODE IMPORTS, IN THE ORDER THE CASCADE HAS ALWAYS READ THEM, loaded with the
 * portal itself (inkrement „Poboljšanje performansi”, korak 2).
 *
 * <p><b>Why the order is written down.</b> Until 22.11.2026 the portal was one piece, and the order of its
 * rules was whatever order the bundler met their stylesheets in while walking the one piece; at equal
 * specificity the later rule wins, so that order was a fact every screen was tuned against without anybody
 * having written it (ADL A7, 13.08.2026: „kod istog stepena specifičnosti odlučuje redosled”). Cut into a
 * piece per screen, the bundler meets them in another order. Measured on the change, with every element's
 * computed style compared in Chrome on 49 addresses at 360, 768 and 1280 against the build before it: the
 * moved order changed what two screens of the administration draw (a refused button lost its
 * `not-allowed` cursor on the queue of teams, and a row of the moderators grew by 3 px). So the order is
 * no longer left to the cut: it is this list, read off the last build that was one piece (the bundler's own
 * module order, per piece, in the order the page loaded the pieces), and the built stylesheet is the
 * same rules in the same order as before.
 *
 * <p><b>Each screen still imports its own stylesheet</b> (ADL A7, „Komponenta traži stilove koje nosi
 * sopstvenim listom”), and `styles/tableScroll.test.ts` still reads those imports; a stylesheet a screen
 * imports and this list already carries is the same module, loaded once.
 *
 * <p><b>A new stylesheet has to be placed here, and where is a decision.</b> `app/stylesheets.test.ts` fails
 * for a stylesheet the code imports and this list does not name, and for one this list names that nothing
 * imports any more. Placed last it can only win the ties it is in, which is what a new screen usually means.
 */
import '../components/Prompt.css'
import '../index.css'
import '../pages/admin/Entity.css'
import '../components/Loader.css'
import '../components/Unreadable.css'
import '../styles/table.css'
import '../pages/Calendar.css'
import '../components/Crop.css'
import '../components/Portrait.css'
import '../pages/Rankings.css'
import '../pages/Competitors.css'
import '../components/DucatArt.css'
import '../components/LoadMore.css'
import '../components/PartsNav.css'
import '../pages/Profile.css'
import '../forms/FormRenderer.css'
import '../forms/FieldHint.css'
import '../forms/DatePicker.css'
import '../forms/PlaceField.css'
import '../forms/Suggesting.css'
import '../components/ActionButton.css'
import '../pages/member/Member.css'
import '../components/CategoryDonut.css'
import '../components/Segmented.css'
import '../components/LengthFilter.css'
import '../components/Markdown.css'
import '../pages/event/GoingToEvent.css'
import '../components/Stars.css'
import '../pages/event/EventComments.css'
import '../components/NamePlate.css'
import '../components/Pager.css'
import '../pages/league/League.css'
import '../components/ColumnChart.css'
import '../components/DucatGallery.css'
import '../components/PageSectionBody.css'
import '../pages/Home.css'
import '../pages/Leagues.css'
import '../styles/counter.css'
import '../pages/Rulebook.css'
import '../pages/TopBoards.css'
import '../components/TeamMark.css'
import '../pages/StaticPage.css'
import '../pages/admin/SectionNav.css'
import '../pages/admin/Activation.css'
import '../pages/admin/AdminMembers.css'
import '../pages/admin/Rights.css'
import '../pages/admin/Verification.css'
import '../styles/outsideLink.css'
import '../components/QrCode.css'
import '../app/NoticeBar.css'
import '../app/RaceInMotion.css'
import '../app/Shell.css'
import 'prosemirror-view/style/prosemirror.css'
import '../components/markdownEditor/MarkdownEditor.css'
import '../pages/event/MemberChoice.css'
/* The sponsors' screen (24.11.2026): placed last, so it wins only the ties it is in, and it has none: every
   selector in it is its own (`sponsor-logo__`, `sponsor-row__`). */
import '../pages/admin/Sponsors.css'
