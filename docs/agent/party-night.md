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

Built so far (#233, #234, #238): hosting a night, the guests' home, the TV
screen, joining by code, link or QR code, and leaving. The activities
themselves are not started from a night yet, so "Now on" is always empty in
practice.

## Screens

| Route | Page | What |
| --- | --- | --- |
| `/host` | `HostParty.tsx` | "Host a party night" is the third `ChoiceCard`, after the quiz and the scoreboard |
| `/n/new` | `NightSetup.tsx` | A title field (default "Party night", 1-60 characters), the host's name spun on the `NamePicker` reel, and the black "Start the party night". `createNight` makes the night with the host as its first guest, then the page saves the identity and replaces itself with `/n/CODE` |
| `/n/:code` | `NightHome.tsx` | The guests' home, in the phone frame. Not joined: the name reel (names on the roster are off it) and the black "Join the party". Joined: the title, the code as a `Badge` with "Show QR code" (`QrFullScreen` for `#/n/CODE`), "Now on" (`NightActivities`), "Who's here" and "Leave the party". The host also has "Open the TV screen", which opens `/n/CODE/screen` in a new tab |
| `/n/:code/screen` | `NightScreen.tsx` | The TV, outside the phone frame (`TvLayout`): the big QR code for `#/n/CODE`, the code, the title, how many guests are here and "Now on". No guest names |
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

- `escparty.night.CODE` = `{ guestId, name, isHost }`, written when a join is
  confirmed or a night is created. The guest id and name are this device's
  for every activity in the night (later activities read them from here).
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
  the QR code's link (`codeFromScan` reads `#/n/CODE`). The reel offers only
  free names (`availablePartyNames`). `joinNight` writes the guest and the
  claim on their name in one batch: `true` saves the identity; `false` means
  someone claimed the name first ("Lordi was just taken. Spin again.", and it
  stays off the reel); a timeout ("Couldn't reach the party, try again")
  keeps the same guest id.
- **Code clashes.** `findGame` looks in rooms, nights and parties. New codes
  are drawn free across all three (`freeCode`, #232), so a clash can only
  come from codes made before. Order: a lobby quiz room (or the one this
  device is in), then the night, then the party, then a running quiz room.
- **Leaving.** "Leave the party" asks first (`ConfirmLeave`), then
  `leaveNight` deletes the guest and the claim in one batch (the name is free
  again), the identity is cleared and the guest lands on Home. A failure is
  shown and can be retried. The host's confirm says the guests keep the party
  but the host can't get the host controls back.
- **Moving.** `moveNight` closes a night and points it at a fresh one
  (`movedTo`). Nothing in the UI moves a night yet; the guests' home and the
  TV already show the "moved" state.

## What's coming

- Starting a quiz or a scoreboard from the night (`createNightRoom`,
  `createParty` with a `nightCode`, then `addNightActivity`), and turning
  "Now on" from information tiles into cards that open each activity.
- The host closing the night, and moving it to a fresh code.
- Activities that reuse the night's guest id and name, so nobody joins twice.
