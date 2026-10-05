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
| `/host`, `/join` | `HostParty.tsx`, `JoinParty.tsx` | Home's ways in: "Host a scoreboard" opens `/party/new`; a party code typed or scanned on Join opens `/party/:code` |
| `/party` | `PartyHome.tsx` | Host, join with a code, open a big screen, or go back to the last party |
| `/party/new` | `PartySetup.tsx` | Pick the show, the rating sheet (premade or your own categories), bonuses, whether awards name names, your name |
| `/party/:code` | `PartyRoom.tsx` | Join (a name), then tabs: Rate, My ranking, The room, and Host (`PartyHostTools.tsx`) for the host |
| `/party/:code/screen` | `PartyScreen.tsx` | The TV: QR code, the code, the room's standings, closest guests. Outside the phone frame |
| `/party/:code/awards` | `PartyAwards.tsx` | One award at a time, then who came closest. Only after the host opens them (the host can preview) |

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
  0-10, plus any party bonuses ticked (sung in their own language +2, wind
  machine +1, key change +1, pyro +1, a grandma on stage +2).
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

The host picks at setup whether the awards name names (`showNames`). With
names off, awards say "one of you" or "two of you", except that each guest
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
  template: { id, name, blurb, categories: { id, label, max }[] },  // 1-6 categories
  bonuses: boolean, showNames: boolean,
  results: { places?: { [actId]: place }, qualifiers?: actId[] },
  revealed: boolean,
  createdAt: serverTimestamp, expireAt: Timestamp  // createdAt + 30 days
}
```

`parties/{code}/ballots/{guestId}`: `{ name, ratings: { [actId]: { [categoryId]: n } }, bonuses: { [actId]: bonusId[] }, updatedAt, expireAt }`
(`expireAt` 30 days after the guest's last change).
One document per guest, written whole by that guest only, so no two
clients ever write the same document.

Rules (`firestore.rules`, verify cases 5i): a party is created with exactly
those keys, an empty result, not revealed, and an `expireAt` 29-31 days
out (the rules accept 1-60 days, since the phone's clock sets it); after
that only `acts`, `results` and `revealed` may change. There's
no sign-in, so like quiz rooms the rules check shape, not who: anyone with
the code could edit the result. Ballots need the party to exist, a 1-40
character name and at most 40 acts. `contests/` is read-only to clients.

## Retention

Every party and every ballot carries `expireAt`, 30 days out
(`PARTY_LIFETIME_DAYS`; the rules accept 1-60 days, as the phone's clock sets it). Nothing is deleted until
the project owner enables a Firestore TTL policy on `expireAt` for both
collection groups, `parties` and `ballots` (Firebase console, Firestore,
Time-to-live). Deleting a party doesn't delete its ballots on its own,
which is why each ballot has its own expiry.
