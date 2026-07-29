/* Cloudflare Email Worker za noreply@balkanskatrkackaliga.net
 *
 * Portal sa te adrese samo salje. Niko ne treba da pise na nju, a onaj ko
 * ipak pokusa mora da dobije jasan odgovor, ne cutanje.
 *
 * Zato se poruka odbija na SMTP nivou umesto da se prosledi ili tiho baci.
 * Razlog ispod ulazi u obavestenje o neisporucenoj posti koje posiljaocev
 * server sam napravi, pa odgovor stize automatski a da mi ne posaljemo nista.
 *
 * Zasto ne pravi autoresponder: odgovor bi isao na adresu iz zaglavlja, koja
 * kod nezeljene poste skoro uvek nije prava. To se zove backscatter, kvari
 * ugled domena sa kog portal salje potvrde uplata, i udvostrucuje odlazni
 * saobracaj bez ikakve koristi.
 *
 * Vezuje se u Cloudflare panelu: Email > Routing > Routes, pravilo za
 * noreply@, akcija "Send to a Worker", ovaj Worker.
 *
 * Prva odbrana nije ovaj Worker nego zaglavlje Reply-To: info@ na svakoj
 * poruci koju portal salje. Ovo hvata samo one koji ipak dodju dovde.
 */

const RAZLOG =
  'Ova adresa ne prima postu. Pisite na info@balkanskatrkackaliga.net. ' +
  'This address does not accept incoming mail. Please write to info@balkanskatrkackaliga.net'

export default {
  email(message) {
    message.setReject(RAZLOG)
  },
}
