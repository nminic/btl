import { useCallback, useMemo } from 'react'
import { useRole } from '../../roles/useRole'
import { ENTITY_FORMS, type EntityDef } from './entityForms'
import { mayOpen, needFor } from './needs'
import { QUEUES, type Queue } from './queues'
import { useMay } from './rights'

/**
 * Whether whoever is at the keyboard may open a given address.
 *
 * The same question the door asks, asked the same way (needs.ts), and asked
 * before a screen is named rather than after it is opened. A moderator is not to
 * be aware that there are actions nobody gave him (owner, 30.07.2026): naming
 * seven queues to somebody who may work in one is telling him about seven doors
 * he cannot open, and every one of them is an invitation to ask what is behind
 * it.
 *
 * A predicate rather than a boolean per call, because the lists that use it ask
 * this of every entry and a hook cannot be called in a loop.
 *
 * Its own file rather than beside either of the two it stands between: needs.ts
 * reads the rights to build the table of what each address wants, so rights.ts
 * cannot read back from needs.ts without the two importing each other.
 */
export function useMayOpen(): (path: string) => boolean {
  const { role } = useRole()
  const may = useMay()

  return useCallback(
    (path: string) => {
      const need = needFor(path)

      // Every address outside administration wants nothing and is open to
      // everybody, which is most of the portal.
      return need === undefined || mayOpen(need, role, may)
    },
    [role, may],
  )
}

/** The queues this person may work in, in the order the section names them. */
export function usePermittedQueues(): Queue[] {
  const open = useMayOpen()

  return useMemo(() => QUEUES.filter((queue) => open(queue.path)), [open])
}

/**
 * The entities this person may open.
 *
 * Seven for the superadmin. For a moderator, those whose box is ticked, less
 * moderators themselves: assigning rights is the single thing the superadmin
 * cannot hand over (PDL P21), so that one has no box to tick and is answered by
 * the same table as everything else (needs.ts).
 *
 * The price list among them since 06.08.2026. It was left out because nothing
 * is created or removed on it and the section was about creating and removing;
 * what that produced was a screen in no section, which the panel had to link to
 * because nothing else did. The section is Podaci now, and a price list is
 * data.
 */
export function usePermittedEntities(): EntityDef[] {
  const open = useMayOpen()

  return useMemo(
    () => ENTITY_FORMS.filter((entity) => open(entity.path)),
    [open],
  )
}
