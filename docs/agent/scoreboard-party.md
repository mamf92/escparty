# Scoreboard party

Read this before touching anything under `/party`, `partyModel.ts`,
`partyFirestore.ts` or the `parties/` and `contests/` rules. Epic #79.

## What it is

Everyone at a Eurovision party rates each act on their phone while it's
performed. The TV shows the room's standings; when the real result comes
in, the host taps it in and everyone sees how close they came. At the end
the host opens the awards: who rated most alike, most differently, most
generously and so on, each named after a moment in Eurovision history.

## Screens

| Route | Page | What |
| --- | --- | --- |
| `/host`, `/join` | `HostParty.tsx`, `JoinParty.tsx` | Home's ways in: "Host a quiz", "Host a scoreboard" and "Host a party night" (`/n/new`, see `party-night.md`) are `ChoiceCard`s in a two-column `ChoiceGrid` (the same dark tiles as the setup picks and quiz cards); "Host a scoreboard" opens `/party/new`; a party code typed or scanned on Join opens `/party/:code` |
| `/party` | `PartyHome.tsx` | Host, join with a code, open a big screen, or go back to the last party |
| `/party/new` | `PartySetup.tsx` | Five steps, one big question each, nothing preselected (local step state, no routes): the show (one `ChoiceCard` per show in a one-column radio `ChoiceGrid`: date, name, acts and how many go through); the rating sheet (`ChoiceCard`s, two to a row: category count, the categories, blurb; premade, or your own categories with a Continue); bonus points (a list of switches for the premade bonuses, all off to begin with, plus one of the host's own with a name and 1 to 5 points, and a Continue); your name, spun on the `NamePicker` reel from `partyNames.ts` (no free text); a summary and the black "Start the party". Back keeps the answers |
| `/join/:code` | `JoinParty.tsx` | A join link, what the green room's "Show QR code" encodes (`joinLink` in `src/utils/joinCode.ts`): fills the code in and looks it up once, like typing it |
| `/party/:code` | `PartyRoom.tsx` | Join (spin the `NamePicker` reel for a name nobody has taken; no free text), then tabs: Rate, Ranking, Room, and Host (`PartyHostTools.tsx`) for the host |
| `/party/:code/screen` | `PartyScreen.tsx` | The TV: QR code, the code, the room's standings, closest guests. Outside the phone frame |
| `/party/:code/awards` | `PartyAwards.tsx` | One award at a time, then who came closest. Only after the host opens them (the host can preview) |

On the Rate tab the sheet is a two-column table (`Sheet`/`SheetRow` in
`src/design`): category on the left, a `Stepper` (a `spinbutton` value between real − and + buttons,
arrow/Home/End keys, drag to scrub, "Not rated" until set) on the right. It
saves through the same `onRate(actId, categoryId, value)`. The room renders
with `calm-compact` (small ball, one-line title) so a five-category sheet fits
one phone screen. e2e's `rateActs` drives the steppers with Home and ArrowUp.

Each guest's place in the running order is kept by act id, so a host
reordering the lineup doesn't move them to another country.

Live data comes from `usePartyData` (two `onSnapshot` listeners: the party
and its ballots). A listener that errors stays stopped, so the screens show
the error with "Try again", which calls the hook's `retry` to attach both
again while keeping what's on screen. The guest's own ratings go through `useOwnBallot`: kept in
localStorage on every tap, saved to Firestore 400ms later, retried every 5s
while that fails, and merged once with the server's copy when it arrives
(`mergeBallots`, this device wins per rating). Leaving the page sends a
save that was still waiting. Ballots are tidied as they're read
(`toBallot` drops non-number ratings and non-list bonuses), since the
rules only check their outline.

Names are unique in a party, and anonymous Eurovision participant names
(`partyNames.ts`). The join reel offers `PARTY_NAMES` minus the names of the
party's ballots (every name again if all are taken). A guest joins with
`joinParty` (#229): one batch creates `names/{key}` (the claim, `key` the
name trimmed and in lower case) and writes their empty ballot, and the host
joins the same way in the batch that creates the party (`createParty(party,
hostName)`). The rules want the two together: a claim needs a ballot with its
name, and a guest's first ballot needs their claim. They only ever create a
claim, so when two guests land the same name at the same instant the second
batch is refused, nothing of it is written, and that guest is told "X was
just taken. Spin again." (the name also stays off their reel). A join keeps
one guest id across tries, so a retry after a timeout (`JOIN_TIMEOUT_MS`;
offline, a write waits rather than fails) finds its own earlier claim:
the unconfirmed join is kept on the device (`savePendingJoin`) with its name
locked, also across a reload, until it lands or is refused. A guest with no
ballot on the server (an identity from before #229) joins on their first save
(`useOwnBallot`).
Parties from before #229 can hold a
pair with one name: the lists tell them apart at display time
(`distinctNames`), the bare name going to the
guest with the lowest guest ID (stable, so names never swap as people rate) and the other
getting "Loreen 2", and a guest's own "you're ..." subtitle uses the same
name (`PartyRoom` computes `withDistinctNames` once for the subtitle and the Room tab). On the join reel a landed name that a ballots
update takes before Join is let go ("X was just taken. Spin again."), and
the reel is off while the ballots haven't loaded, and if the ballots (or party) listener errors first, the join screen shows `PartyError` with "Try again" instead of the reel and Join stays off, so nobody joins without the taken names being known (`useOwnBallot` therefore always has the server copy to merge with). `distinctNames` and `availablePartyNames` share `firstFreeNumbered` (`freeName.ts`). A template whose `bonuses` is present but unusable means no bonuses; only an absent list (older parties) falls back to the premade five. Older parties may
still hold duplicates, so lists of guests (the room's closeness list, the
big screen, the awards) show `withDistinctNames`: a repeat gets " 2", " 3" in
guest-ID order.

When the host loads a new lineup, places and qualifier ticks of acts that
left go in the same write, and the places left are renumbered;
`resultsFor` trims the same way wherever a result is read.

## The shows (#82)

`src/data/contests2027.ts` holds Burgas 2027 semi-final 1 (11 May), semi-final
2 (13 May) and the grand final (15 May). **The lineups are fictive**:
countries confirmed or likely, a made-up running order, artists and songs
"To be announced".

The real lineup goes in Firestore by hand (the project owner, in the
Firebase console; clients can't write it): a document
`contests/<show id>` shaped like a `Contest`:

```ts
{
  title: "Burgas 2027 · Grand final",   // optional, falls back to the bundled one
  kind: "final",                        // or "semi"
  qualifiers: 10,                       // semis only
  date: "2027-05-15",
  acts: [{ id: "se", country: "Sweden", flag: "🇸🇪", artist: "…", song: "…" }, …]
}
```

`fetchContest` prefers that document and falls back to the bundled lineup if
it's missing, empty or unreadable, so a party can always start. Act ids are
lowercase country codes (`[a-z0-9-]{1,20}`), stable within a show because
ballots and results key on them. A new party copies the lineup; a running
party's host can move acts, fill in artists and songs, or "Load the latest
lineup" from `contests/`.

## Rating and scoring (`partyModel.ts`)

- **Sheets**: The Jury (vocals, performance, composition, originality,
  overall impression, 1-10 each), MGP Sofa (song, performance, outfit &
  staging, crowd-pleaser), Douze Points (one 1-12 score), or up to six
  custom categories, each 1-5, 1-10 or 1-12.
- **An act's score** is the mean of its rated categories, each scaled to
  0-10, plus any party bonuses ticked. The host switches on the ones that
  count at setup, from the premade `PARTY_BONUSES` (sung in their own
  language +2, wind machine +1, key change +1, pyro +1, a grandma on stage
  +2) and optionally one of their own (id `own`, a name up to 30 characters,
  1 to 5 points; `bonusProblems` checks it). The chosen list is
  `template.bonuses`, and `partyBonusList` (`partyResults.ts`) is the one
  place that reads it: with `bonuses` false it is empty, and a party from
  before the list existed (no `template.bonuses`) offers all five premade
  ones.
- **The room's standings** average each act over the guests who rated it.
- **Closeness to a final's result** (#86): only acts with a real place
  count, and only the ones the guest rated: both the guest's scores and
  the real places are ranked among those acts (ties share the average
  place), so skipping an act doesn't shift the rest. Each act earns 12, 8, 5, 3, 1 or 0 by how
  many places off it is. A half-entered result compares like with like.
- **A semi-final** only reveals who goes through, so a guest's top N (N =
  qualifiers entered so far) earns 12 per act that went through.

## Awards (#87)

| Award | For | Needs |
| --- | --- | --- |
| The Jedward Twins | Most alike (highest Pearson correlation over shared acts) | Two guests sharing 3+ rated acts, positive correlation |
| Lordi & Salvador Sobral | Most different (lowest correlation) | Same, not the same pair, correlation under 0.3 |
| Euphoria / Nul Points | Highest / lowest average | Averages differ |
| The Wind Machine | Biggest spread | Any spread |
| Lasha Tumbai | Above the room's average, and the most even | |
| Hatari | Lowest score for the room's favourite | Favourite rated by 2+ |
| The Babushki | Most bonuses ticked | Bonuses on |
| The Johnny Logan | Closest to the real result | A result with points |

Guests need 3+ rated acts to count. An award the data can't support is
left out rather than faked.

## Privacy (#89)

The awards name names for every new party: the setup no longer asks, since
guests' names are already the anonymous Eurovision participants from the
reel, and it writes `showNames: true`. The field stays on the party, and
the code for `showNames: false` stays, for parties made while the host
could choose. With names off, awards say "one of you" or "two of you", except that each guest
is told when one is theirs, and the closeness table shows only their own
place. The TV never shows anyone's own ratings; it names the closest
guests only when names are on.

Anonymous awards are a courtesy, not a secret: ballots are readable by
anyone with the party code (the standings and awards are worked out on
each device), the same trust level as a quiz room, so a curious guest with
developer tools could work out who won what. The setup screen says so. Real
secrecy would need the awards worked out server-side (a Cloud Function),
which the project doesn't have. Don't put anything in a ballot a guest
wouldn't want the room to see.

## Data (`partyFirestore.ts`)

`parties/{code}` (4 uppercase letters, like rooms but a separate
collection):

```ts
{
  code, hostId, title, contestId, kind: "semi" | "final", qualifiers,
  acts: Act[],                    // 1-40
  template: {
    id, name, blurb, categories: { id, label, max }[],              // 1-6 categories
    bonuses?: { id, label, points }[],                              // the host's chosen bonuses, 1-8, points 1-5
  },
  bonuses: boolean,               // whether any bonus is on (template.bonuses is non-empty)
  showNames: boolean,             // true for new parties; older ones may be false
  results: { places?: { [actId]: place }, qualifiers?: actId[] },
  revealed: boolean,
  nightCode?: string,             // the party night it was made in (#232), only set at creation
  createdAt: serverTimestamp, expireAt: Timestamp  // createdAt + 30 days
}
```

`parties/{code}/ballots/{guestId}`: `{ name, ratings: { [actId]: { [categoryId]: n } }, bonuses: { [actId]: bonusId[] }, updatedAt, expireAt }`
(`expireAt` 30 days after the guest's last change).
One document per guest, written whole by that guest only, so no two
clients ever write the same document.

`parties/{code}/names/{key}`: `{ name, guestId, expireAt }`, the name claim
(`key` = `nameKey(name)`, which the rules check against `name`). Created
with the guest's first ballot (`joinParty`, or `createParty` for the host),
never changed, read one at a time (`get`), never listed. Deleted only
together with the guest's ballot, and only in a party with a `nightCode`
(below).

`template.bonuses` sits inside the template because the rules fix a party's
top-level keys and check only `template.categories`, so the bonus list
needs no rules change. Anyone with the code could write it, so
`listenToParty` tidies it with `sanitiseBonuses` (drops entries that aren't
`{ id, label <= 30, points 1-5 }` and repeated ids).

Rules (`firestore.rules`, verify cases 5i): a party is created with exactly
those keys, an empty result, not revealed, and an `expireAt` 29-31 days
out (the rules accept 1-60 days, since the phone's clock sets it); after
that only `acts`, `results` and `revealed` may change. There's
no sign-in, so like quiz rooms the rules check shape, not who: anyone with
the code could edit the result. Ballots need the party to exist, a 1-40
character name and at most 40 acts. A first ballot needs its guest's claim
on its name, and a ballot's name never changes after that. A name claim needs the party to exist,
exactly `name`, `guestId` and `expireAt`, its id to be the name trimmed
and in lower case, and the guest's ballot under that name in the same
write; it can't be overwritten (verify case 5b). Both use
`existsAfter`/`getAfter`, since the host's party, claim and ballot are one
batch.

A party can be made inside a party night (#231, #232): `nightCode` is an
optional key at creation (a 4-letter code of a night that exists, never
changed afterwards; `NewParty`/`Party` in `partyFirestore.ts` carry it). Only
in such a party may a ballot and its name claim be deleted, and only together,
in one batch (`leaveParty(code, guestId, name)`, a guest leaving the night): the
ballot's delete needs the claim on its name gone after the write and the
claim's delete needs its ballot gone, so neither goes alone. A standalone
party keeps `delete: false` on both (verify case 5j). A night lists the
party as a `scoreboard` activity once the party exists with the night's code.
The code of a new party is drawn by `freeCode()`, free among rooms, parties
and nights. Party nights: `docs/agent/firestore-data-model.md`.
`contests/` is read-only to clients.

## Retention

Every party and every ballot carries `expireAt`, 30 days out
(`PARTY_LIFETIME_DAYS`; the rules accept 1-60 days, as the phone's clock sets it). Nothing is deleted until
the project owner enables a Firestore TTL policy on `expireAt` for both
collection groups, `parties`, `ballots` and `names` (Firebase console, Firestore,
Time-to-live). Deleting a party doesn't delete its ballots or name claims on
its own, which is why each has its own expiry.
