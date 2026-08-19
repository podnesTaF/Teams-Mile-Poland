# Check-in volunteer: race morning on your phone

One page. Read it once the night before, keep the phone charged.

Everything lives at **https://poland.acebattle.run**. The sign-in page follows the site language
you pick; every admin screen below it is English-only.

---

## 1. Before the first runner arrives — sign in once

1. Open **https://poland.acebattle.run/auth/sign-in** on your own phone.
2. Sign in with the email the organiser gave check-in access to. Tick **Remember me** so
   the session survives the morning.
   - No password yet? Use **Set one now** at the bottom of that page — it emails you a link.
3. Go to **https://poland.acebattle.run/admin/scan** and allow the camera when asked.
4. Add that page to your home screen. It is the only page you need all morning.

Do this at home on wifi, not in the start area on a cold phone.

## 2. Scanning: use the app, not the phone's camera

Check runners in from **/admin/scan** — the in-app scanner. Point it at the QR on the
runner's ticket (paper or phone screen); it opens their check-in page by itself.

If you scan with the **phone's own camera app** instead, the ticket opens in a plain
browser with no admin session and you will see the runner's ticket but **no buttons**.
That is not broken. Scroll to the very bottom of the page and tap **Staff sign-in** — it
signs you in and drops you straight back onto that same runner, panel open. Then go back
to /admin/scan for the rest of the morning.

No camera at all (permission refused, borrowed phone, cracked lens)? Use the check-in
desk instead: **Admin → Events → [race] → Check-in**, and search by surname, email, or
bib. Everything below works the same there.

## 3. The panel — what each button does

After a scan you get a red-bordered **Admin · check-in** panel under the ticket, with the
runner's name, email, club, status and heat.

| What you see | What it means | What to do |
| --- | --- | --- |
| **Check in** | They have not been marked present yet. | Tap it. It assigns the next free bib and marks them present in one go — the panel then shows the bib in large type. Read the number out and hand them that bib. |
| `Next free bib: 42` under the button | What they will get. | Nothing. If they need a *specific* number instead, use the check-in desk, not the scanner. |
| `Bib 42 was pre-assigned in the heat builder` | Their number was set in advance. | Tap **Check in** — it confirms that number rather than giving a new one. |
| **bib pending** after check-in | Every bib in the pool is out on loan. They are checked in, just without a number yet. | Send them to the start area anyway. When a heat finishes and numbers come back, re-scan them and tap **Assign bib N**. |
| **Assign bib N** | A freed number is waiting for a runner who checked in bib-less. | Tap it, hand over the bib. |
| **heat run** | Their heat is already finished; their bib went back to the pool. | Nothing to do — they are done. |
| **Scan next runner** | Appears after a successful check-in. | Tap it. Straight back to the camera for the next person. |
| **Check-in desk** | The full desk for this race — search, no-show, undo, heats. | Use it for anything the panel does not offer. |

Bibs are **loans, not identities**: a number returns to the pool when its heat is marked
finished and is handed to the next runner. So the same bib is worn by different people
during the morning, and that is correct.

## 4. Freeing bibs when the pool runs dry

Only one person should do this, and it happens at the check-in desk, not the scanner:
**Admin → Events → [race] → Check-in**, scroll to the heat list, and press **Mark
finished** on a heat that has actually run. Every bib its runners held returns to the
pool at once.

Never mark a heat finished to make room. Mark it finished because it ran.

## 5. When something is wrong — call, don't improvise

Call the race-morning lead. Do not undo, re-check-in, or hand out a duplicate number on
your own — two runners in the same number at the same time is the one mistake that costs
a result.

Call for:

- **"That bib is taken"** / another runner is already holding the number.
- A runner insists they are registered but the QR opens **Not found** (404), or the page
  says the link is invalid — expired or hand-typed links do this.
- Someone with no ticket at all (a walk-up), or a name that does not appear in search.
- A runner who was checked in by mistake, or who leaves before their heat.
- The scanner shows *"That QR code is not a race ticket"* for a ticket you know is real.

> **Race-morning lead:** ______________________  phone ______________________
> **Backup / organiser:** info@poland.acebattle.run

Fill those two lines in before the race and print this page.

## 6. Quick reference

- Scanner: `/admin/scan`
- Check-in desk: `/admin/events/<race>/checkin`
- Sign-in: `/auth/sign-in`
- Signed out on a scanned ticket → **Staff sign-in** at the bottom of the page.
- After each check-in → **Scan next runner**.
