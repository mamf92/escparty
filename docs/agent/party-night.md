# Party night

Read this before touching anything under `/n`, `nightSession.ts`,
`nightsFirestore.ts` or the `nights/` rules. Epic #231; the data model and
rules are in "Party nights" in `docs/agent/firestore-data-model.md`.

## What it is

One 4-letter code for the whole evening. A host starts a night, guests join
it once, and every quiz and scoreboard party played that night is listed on
it, so nobody types a new code or picks a new name between games. A night is
a thin layer above quiz rooms and scoreboard parties: it holds the title, the
guests and the list of activities, and nothing about how any of them is
played.

Built (#233-#238): hosting a night, the guests' home, the TV screen, joining
by code, link or QR code, leaving, starting quizzes and scoreboards from the
night and playing them with the night's one id and name, and the host's tools
(end the night, start over with a new code).

## Screens

| Route | Page | What |
| --- | --- | --- |
| `/host` | `HostParty.tsx` | "Host a party night" is the third `ChoiceCard`, after the quiz and the scoreboard |
| `/n/new` | `NightSetup.tsx` | A title field (default "Party night", 1-60 characters), the host's name spun on the `NamePicker` reel, and the black "Start the party night". `createNight` makes the night with the host as its first guest, then the page saves the identity and replaces itself with `/n/CODE` |
| `/n/:code` | `NightHome.tsx` | The guests' home, in the phone frame. Not joined: the name reel (names on the roster are off it) and the black "Join the party". Joined: the title, the code as a `Badge` with "Show QR code" (`QrFullScreen` for `#/n/CODE`), "Start something" (host), "Now on" (`NightActivities`, a card per activity), "Who's here", "Host" (host) and "Leave the party". The host also has "Open the TV screen", which opens `/n/CODE/screen` in a new tab |
| `/n/:code/screen` | `NightScreen.tsx` | The TV, outside the phone frame (`TvLayout`): the big QR code for `#/n/CODE`, the code, the title, how many guests are here and the newest activity (`NightScreenActivity`, see "On the TV"). No guests' names |
| `/join`, `/join/:code` | `JoinParty.tsx` | A night's code opens `/n/CODE`; see "Joining" |
| `/` | `Home.tsx` | A device with a stored night gets a white "Back to your party night" under Join |

States: the home and the TV show the `Loader` (home) or a status note (TV)
while loading, `NightNotFound` ("No party night with the code ABBA", back to
Join) for a code nobody has, and `NightError` ("Try again", which is
`useNightData`'s `retry`) when a listener failed. A closed night says "This
party night is over."; a guest who isn't in it can't join. A night that
moved says "The party moved to WXYZ." with one black button to `/n/WXYZ`
(`/n/WXYZ/screen` on the TV).

## Identity and session

`src/utils/nightSession.ts` keeps, per night code in localStorage:

- `escparty.night.CODE` = `{ guestId, name }`, written when a join is
  confirmed or a night is created. The guest id and name are this device's
  for every activity in the night (later activities read them from here).
  Who hosts isn't stored: it is whoever the night's `hostId` names.
- `escparty.night.CODE.joining` = `{ guestId, name }`, a join that was sent
  and not confirmed. A retry reuses the same id and name (also after a
  reload), so a write that landed late is found by `joinNight` instead of
  leaving a second guest.
- `escparty.lastNight` = the code, so Home can offer the way back.
  `lastNightCode()` returns it only while that night's identity is stored.
  `clearNightIdentity(code)` removes the identity, the pending join and the
  pointer if it points there.

Every read and write is in try/catch: private mode only costs the resume.

A stored identity is only trusted while the roster has the guest:
`fetchNightGuest` is read once on load (offline, the identity is kept), and
if a roster snapshot lacks a guest it earlier contained, the identity is
cleared and the join view shows. The host is the guest whose id is
`night.hostId`; with no sign-in that is the page's job, not the rules'.

## Joining, leaving, moving

- **Joining.** The code typed or scanned on Join goes through
  `findGame` (`src/utils/joinCode.ts`) and a night opens `/n/CODE`; so does
  the QR code's link (`codeFromScan` reads `#/n/CODE`). The join is the
  shared `ReelJoin` (`src/components/`, the same as a party's). The reel offers only
  free names (`availablePartyNames`). `joinNight` writes the guest and the
  claim on their name in one batch: `true` saves the identity; `false` means
  someone claimed the name first ("Lordi was just taken. Spin again.", and it
  stays off the reel); a timeout ("Couldn't reach the party, try again")
  keeps the same guest id.
- **Code clashes.** `findGame` looks in rooms, nights and parties. New codes
  are drawn free across all three (`freeCode`, #232), so a clash can only
  come from codes made before. Order: a lobby quiz room (or the one this
  device is in), then the night, then the party, then a running quiz room.
- **Leaving.** "Leave the party" asks first (`ConfirmLeave`). Before
  `leaveNight` deletes the guest and the claim in one batch (the name is free
  again), `leaveNightActivities` tidies up, best effort and per activity: in
  each scoreboard where the guest has a ballot (`fetchBallot`) `leaveParty`
  deletes the ballot and the claim, and the party's stored identity is cleared,
  but only until the host has entered the real results (`hasResults`) or
  opened the awards (`revealed`): after that the ballots stay, as the standings
  and awards are worked out from them, and only the stored identity goes. A
  scoreboard the guest hosts is left alone, as a hosted quiz is; from each quiz room still in its lobby that lists the guest (and isn't theirs)
  `removePlayerFromRoom` takes them out. A failure there is logged and never
  stops the leave. Then the identity is cleared and the guest lands on Home; a
  failure of the leave itself is shown and can be retried. The host's confirm
  says the night ends for everyone: the host closes it (`closeNight`) before
  leaving.
- **Moving.** `moveNight` closes a night and points it at a fresh one
  (`movedTo`). The host's "Start over with a new code" asks first, then makes a
  new night with the same title and the host as its first guest (`createNight`),
  moves the old one to it, saves the new identity and opens `/n/NEW`. A retry
  after a failed move carries the guests to the night already made. Guests on
  the old night see "The party moved to NEW." with "Join NEW" and pick names
  again; activities stay with the old code.
- **Ending.** "End the party night" asks first, then `closeNight`: guests see
  "This party night is over."; nobody joins and nothing is added (the host's
  "Start something" and "Host" go away).

## Activities (#235, #236)

The host's "Start something" has two white buttons.

- **Start a quiz** opens `/multiplayer` on its host step with `{ step: "host",
  nightCode }`; see "A quiz started from a party night" in
  `multiplayer-sync.md`. The activity is titled "Quiz", "Quiz 2"...
- **Start a scoreboard** opens `/party/new` with `{ nightCode }`; see
  `scoreboard-party.md`.

Both use the night's guest id and name, read from `nightSession` (without that
identity on this device the same screens make an ordinary game). Each is made
first and listed with `addNightActivity` after, since the rules only list what
exists for this night; a failed listing is said and a retry lists what was made.

"Now on" is a card per activity, newest first: a dark tile (kind, title, where
it stands) and a white button. Each card follows its room or party live
(`useRoom`, `usePartyData`; fine for the 20 a night holds). Scoreboard: "Rate".
Quiz: in the lobby "Join the quiz" ("Back to the waiting room" for a player,
the host included); started and a player, "Back to the quiz"; started and not a
player, "In progress"; finished, "See the results" for players and "Finished"
for others. A quiz's results end with "Back to the party night" (no next round
in a night), and a scoreboard's room with the same link. No card is the black
button.

## On the TV

`NightScreenActivity` shows the newest activity under the QR code. A quiz in its
lobby names who is waiting (the quiz's players, not the night's roster); a
running quiz names who is playing, with no scores while questions are open; a
finished quiz shows its standings (`Standings`) only as far as the host's
step-by-step reveal on the phones (`room.revealStep`, `revealedPlaces`) has
got, and in full once it is over; a scoreboard shows
the room's standings (`RoomStandings`, shared with `PartyScreen`). "Nothing on
yet" when empty.
