/*
 * A MEMBER MAY ASK TO JOIN THE LEAGUE'S COMMUNITY ON VIBER, AND THE ASKING NEEDS A TELEPHONE.
 *
 * Owner, PDL P36, 20.11.2026, „Pored telefona stoji kvadratić za BTL zajednicu na Viberu": a box beside the
 * telephone on the registration and on „Moji podaci", and „Kad je kvadratić štikliran, telefon je obavezan".
 * Who ticked it is seen on the screen of the moderation of the members, „a vlasnik ga ručno dodaje u
 * zajednicu". P22 stands: „Nema integracije sa portalom i portal kroz Viber ne šalje ništa automatski. Vodi se
 * ručno." So the portal keeps the wish and nothing else, and this column is the whole of it.
 *
 * THE MOMENT AND NOT A FLAG, which is the assistant's reasoning and the shape of `health_statement_at` (V8): the
 * wish is something the member gives, and the moment says when. NULL is „he has not asked", one way of saying the
 * absence, as V8 says of the telephone; a member who takes the wish back is NULL again.
 *
 * `competitor_viber_community_needs_a_phone` is the owner's „telefon je obavezan" as the schema says it: a wish
 * with no number is a wish nobody can act on. The routes that write a wish or empty a telephone refuse such a
 * request in words before it reaches this rule; the rule is the floor under them.
 *
 * ROWS ALREADY STANDING ARE NOT TOUCHED. Nobody has asked yet, so every member there is is NULL, which the rule
 * accepts whatever his telephone. No default, so a member written by a route that does not name the column (the
 * league's group entry) has not asked either. Measured over rows written as a database holds them by
 * ViberCommunityCarriedOverTest.
 */
alter table competitor
    add column viber_community_at timestamptz,
    add constraint competitor_viber_community_needs_a_phone
        check (viber_community_at is null or phone is not null);
