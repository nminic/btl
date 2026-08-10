import { eventClash, eventSlug } from './entityForms'

/**
 * Two events at one address.
 *
 * The address of an event is made of its name and the day it is run
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

  it('lets the same name through on another day, which is what a copy is', () => {
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
