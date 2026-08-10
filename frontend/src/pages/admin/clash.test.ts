import { addressOfEvent, eventClash, eventSlug } from './entityForms'

/**
 * Two events at one address.
 *
 * The address of an event is made of its name and the year it is run in
 * (`eventSlug`), and copying one keeps both until somebody changes the date. A
 * copy saved untouched is therefore a second record answering where the first
 * one answers, and everything that joins to an event by address then means both
 * of them: the results of one are the results of the other, and deleting either
 * takes the other's with it.
 */
describe('eventClash', () => {
  const taken = [eventSlug('Maraton maratona', '14/03/2015')]

  it('refuses a day that puts the event where another one already answers', () => {
    expect(eventClash({ name: 'Maraton maratona', date: '14/03/2015' }, taken)).toEqual({
      date: { key: 'admin.eventTaken' },
    })
  })

  it('lets the same name through in another year, which is what a copy is', () => {
    expect(eventClash({ name: 'Maraton maratona', date: '14/03/2027' }, taken)).toEqual({})
  })

  it('lets another name through on the same day', () => {
    expect(eventClash({ name: 'Neka druga trka', date: '14/03/2015' }, taken)).toEqual({})
  })

  it('reads the day the way the form writes it, not the way the record stores it', () => {
    /* The form speaks dd/mm/gggg and the record stores gggg-mm-dd. Read without
       that in mind the computed address carried no date at all and no copy ever
       clashed with anything. */
    expect(eventSlug('Maraton maratona', '14/03/2015')).toBe('maraton-maratona-2015')
  })
})

describe('the address a save leaves an event at', () => {
  const was = {
    id: 'evt-gradska-liga-usce-2017-05-06',
    name: 'Gradska liga - Ušće',
    date: '2017-05-06',
    /* Its address carries the month, because the same name was run twice that
       year and the rule can only build the name and the year. The generated
       data holds fifteen such pairs. */
    slug: 'gradska-liga-usce-2017-05',
    city: 'Kragujevac',
  }

  it('leaves an address the rule cannot build where nothing it is made of changed', () => {
    /* The town corrected, the name and the day untouched. Recomputed, the
       address would collapse onto the one its sibling of November answers at:
       every result of it would come loose, and the sibling could never be saved
       again, because the form would refuse the address as taken. */
    expect(
      addressOfEvent({ name: was.name, date: '06/05/2017', city: 'Niš' }, was),
    ).toBe('gradska-liga-usce-2017-05')
  })

  it('follows the year where the year is what changed', () => {
    expect(addressOfEvent({ name: was.name, date: '06/05/2018' }, was)).toBe(
      'gradska-liga-usce-2018',
    )
  })

  it('follows the name where the name is what changed', () => {
    expect(addressOfEvent({ name: 'Gradska liga - Ada', date: '06/05/2017' }, was)).toBe(
      'gradska-liga-ada-2017',
    )
  })

  it('stays put when the day moves inside the year, which is the point of it', () => {
    /* Owner, 10.08.2026: an event put off a week keeps its address, and with it
       everything joined to it. */
    expect(addressOfEvent({ name: was.name, date: '13/05/2017' }, was)).toBe(
      'gradska-liga-usce-2017-05',
    )
  })

  it('builds one from nothing where there is no record yet', () => {
    expect(addressOfEvent({ name: 'Novi maraton', date: '01/06/2027' })).toBe(
      'novi-maraton-2027',
    )
  })

  it('reads a stored date as well as a typed one, which is what a copy hands over', () => {
    /* The copy of an event hands over the shape a record keeps. Read as a form
       value alone it produced an address with no year in it, which the rule can
       never build and which the guard against a shared address cannot match. */
    expect(eventSlug('Maraton maratona', '2015-03-14')).toBe('maraton-maratona-2015')
    expect(eventSlug('Maraton maratona', '14/03/2015')).toBe('maraton-maratona-2015')
  })
})

describe('a name the address cannot be spelt from', () => {
  it('takes the whole day, so two of them are two addresses', () => {
    /* The calendar carries Greek races and the table of letters spells Latin and
       Cyrillic. With the name gone the address would be the year alone: two
       races of one season at one address, and the form refusing the second one
       for a name that is not taken. */
    expect(eventSlug('Υψηλάντειος Αγώνας Δρόμου', '2019-09-14')).toBe('2019-09-14')
    expect(eventSlug('Παναθηναϊκός δρόμος', '2019-01-05')).toBe('2019-01-05')
  })

  it('is refused where another event already answers there', () => {
    expect(
      eventClash({ name: 'Υψηλάντειος Αγώνας Δρόμου', date: '14/09/2019' }, ['2019-09-14']),
    ).toEqual({ date: { key: 'admin.eventTaken' } })
  })
})

describe('the address a clash is tested against', () => {
  it('is the one the save will leave, not the one the rule would build', () => {
    /* An event whose address carries the month keeps it while the name and the
       year stand. Tested against the rule's answer instead, a save that changed
       nothing but the town was refused for an address it was not taking, and
       the message told the administrator to change the year of a race run eight
       years ago. */
    const was = {
      name: 'Gradska liga - Ušće',
      date: '2017-05-06',
      slug: 'gradska-liga-usce-2017-05',
    }

    expect(
      eventClash(
        { name: was.name, date: '06/05/2017', city: 'Niš' },
        ['gradska-liga-usce-2017'],
        was,
      ),
    ).toEqual({})
  })
})
