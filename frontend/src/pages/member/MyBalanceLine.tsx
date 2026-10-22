import { money } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { useMyBalance } from './useMyBalance'

/**
 * THE LINE „600 RSD na balansu", off the book.
 *
 * <p><b>Nothing at all until the book has been read, and nothing where it could not be.</b> A
 * figure that was not read is not a nought: this line said „0 RSD" over a book that held six
 * hundred (22.10.2026), and a placeholder dash would be a second answer where the true one is „I do
 * not know". `useMyCategory`'s box is the precedent in the same screen: drawn when its own read
 * comes back, or not at all. The sentence under it (`membership.balanceNote`) says what a balance
 * is and is the screen's, drawn either way.
 *
 * <p><b>The money is the server's, amount and currency together.</b> A member has one balance in
 * one money (`MyMembershipApi`, V42), so the currency is not worked out again from his country
 * here, and a balance in euro is drawn in euro whatever the profile says.
 *
 * @param asked whose book this is (see `useMyBalance`)
 */
export function MyBalanceLine({ asked }: { asked: number | string }) {
  const { locale, t } = useI18n()
  const balance = useMyBalance(asked)

  if (balance.status !== 'ready') {
    return null
  }

  return (
    <p className="membership__balance">
      <strong>{`${money(balance.data.amount, locale)} ${balance.data.currency}`}</strong>{' '}
      <span>{t('membership.balance')}</span>
    </p>
  )
}
