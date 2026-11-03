# NFC Stamp: Hardware Guide

How to make the physical "stamp" that customers tap their phones on, and how to set up the tags. For the software side, see `LOYALTY_SPEC.md` §5.

---

## 1. Which tag to buy

| Tag | Use | Security | Rough price in India* |
|---|---|---|---|
| **NTAG213 / NTAG215** (stickers or coins) | Prototype, pilot, demos | **Basic.** The URL is static and can be copied, so stamps need approval or a bill match. | ₹15–50 each |
| **NTAG 424 DNA** (sticker/coin/inlay) | **Production stamps** | **Secure.** It generates a new signed URL (SUN) on every tap and can't be cloned. | roughly ₹150–400 each |
| **Anti-metal / on-metal** version of either | Only if the stamp sits on or near metal (steel counters, metal stands) | Same as above | A bit more |

\*Prices vary. Check Robu.in, Amazon.in, IndiaMART and NFC-specialist sellers. Buy 2–3 extra of each for testing.

**Recommendation:** buy about 10 NTAG215 now to build and demo, plus a few NTAG 424 DNA tags once the claim flow works.

> ⚠️ **The blue keychain fobs that come with RC522 Arduino kits are usually MIFARE Classic 1K, not NTAG.** iPhones can't read MIFARE Classic at all, and many Android phones can't either (it needs an NXP NFC chip). Some blue fobs aren't even NFC: they're 125 kHz RFID that no phone can read.
> - **Check first:** scan the fob with the free NFC Tools app on Android and look at "Tag type".
> - If it says **NTAG213/215/216**, the fob is perfect for the prototype.
> - If it says **MIFARE Classic**, use it only for development on a phone that can read it, and buy **"NTAG215 keychain"** fobs instead. They're sold in the same blue keychain shape and work on every NFC phone.

---

## 2. Making the stamp object

The stamp is a branding piece. It should look like a café rubber stamp, a coaster-sized "seal" or a wooden block with the logo on the face.

- **Body:** wood, resin, acrylic or 3D-printed PLA. **No metal** around or above the tag: metal blocks NFC.
- **Tag position:** the flat face the phone touches. Keep the tag **less than ~5 mm from the surface**. A 25–30 mm round tag fits well.
- **Size:** at least 50–60 mm across, so it's easy to hit with the phone.
- **Face design:** the café logo plus a small NFC "tap" icon. Put on a printed card or table tent next to it:
  *"Tap your phone here to collect a stamp"* + *"No NFC? Scan the QR →"* + where the antenna is: "iPhone: tap the top edge · Android: tap the middle of the back".
- **Fixing it:** glue or screw it to the counter so it can't walk away. With NTAG 424, a stolen stamp can be **deactivated** in the merchant console and a new one registered.
- **Ideas for selling:** offer it as a branded product (laser-engraved wood, custom resin with the café's colours). It's a nice physical upsell with the subscription.

---

## 3. Programming the tags

### 3.1 NTAG213/215 (pilot): with your ESP32
**Quick test only (any phone):** with NFC Tools on iPhone, go to Write → Add a record → URL, write any link, lock the screen, unlock, and tap. A banner should appear. This proves the tag works, but it **can't** turn on the tap counter.

**Real pilot tag (turns on the UID + counter mirror):**
1. Create the stamp point: in the merchant console → **Stamp points → Add → "NFC (basic)"**, choose the outlet. Until the console exists, use the temporary CLI: `pnpm loyalty:stamp-point create --outlet <id> --kind nfc_basic --label "Counter stamp"`.
2. Run `pnpm nfc:provision --mode basic --stamp-point <id>` with the ESP32 + reader plugged into the Windows dev PC (USB serial shows up as a `COMx` port; install the CP210x or CH340 driver for your ESP32 board if it doesn't).
3. Hold the NTAG215 on the reader. The tool:
   - writes the URL `https://<stamp-domain>/s/<stampPointId>?t=<token>&m=00000000000000x000000` (the short, dedicated stamp link domain from `packages/config/brand.ts`);
   - sets the NTAG21x **MIRROR** config bytes (`MIRROR_CONF = 11b`, UID + counter; `MIRROR_PAGE`/`MIRROR_BYTE` pointing at the first `0` after `m=`) so the tag writes the UID, an `x` and the NFC read counter into that one placeholder block. With both mirrors on, the tag always writes them contiguously; separate `uid=`/`c=` params are not possible;
   - enables the read counter (`NFC_CNT_EN`);
   - sets a write password, so nobody can overwrite the tag, but it stays reconfigurable by you.
4. Tap it 3 times with your phone. The 6 hex digits after the `x` in `m=` should go up each time, and the console's "Test tap" should show a pass.
5. Don't permanently lock it during the pilot. Use the password protection instead.

**Reader support for basic tags:** an RC522 or PN532 on the ESP32 both work. NTAG21x config pages are normal page writes. **Wiring (ESP32 ↔ RC522, SPI):** SDA/SS→GPIO5, SCK→GPIO18, MOSI→GPIO23, MISO→GPIO19, RST→GPIO22, 3.3V→3V3, GND→GND. **The RC522 needs 3.3 V, not 5 V.**

### 3.2 NTAG 424 DNA with SUN (production)
These need **AES keys** and **SDM (Secure Dynamic Messaging)** settings, which a basic writer app can't configure. Two options:

- **Option A: ask the seller to pre-configure.** Many NFC suppliers will enable SUN with your URL template and give you the keys. Ask for:
  - the URL template: `https://<stamp-domain>/s/<stampPointId>?picc=<PICCData>&cmac=<CMAC>`
  - encrypted PICC data (UID + read counter) and a CMAC mirror
  - the **SDM meta-read key** and **SDM file-read key** (and change the master key from the default)
  
  Then enter the keys in **Stamp points → Add → "NFC secure (424)"**. They're stored encrypted and never sent to the browser.
- **Option B: configure them yourself with Arduino (our chosen route).** See §3.3.
- **Option C: PC software.** NXP's free **TagXplorer** with a USB reader (ACR1252U). Use this only if the Arduino route fails.

Whatever the route, follow NXP **application note AN12196** ("NTAG 424 DNA and NTAG 424 DNA TagTamper features and hints"). It has the exact command sequence plus the test vectors our server code is tested against.

### 3.3 DIY provisioning with Arduino (`tools/nfc-provisioner/`)

**Hardware support:**
| Setup | Basic tags (NTAG213/215) | NTAG 424 DNA with SUN |
|---|---|---|
| RC522 (MFRC522) + any board | Yes | **No.** The `mfrc522_ntag424dna` library can authenticate and change keys, but it cannot enable SDM/SUN. |
| PN532 + Arduino Uno | Yes | No: not enough memory for AES/CMAC |
| **PN532 + ESP32** | Yes | **Yes**, via the `Adafruit-PN532-NTAG424` fork (ESP32-only; needs mbedtls CMAC). Connect the PN532 over I2C or SPI. |

**Claude Code task: build `tools/nfc-provisioner/`**

1. **ESP32 sketch (PlatformIO)**
   - Commands come in over USB serial as JSON lines: `{"cmd":"write_basic","url":…}`, `{"cmd":"provision_424","urlTemplate":…,"keys":…}`, `{"cmd":"read_uid"}`, `{"cmd":"test_tap"}`.
   - Replies go back as JSON lines too.
   - The sketch **never makes up keys or stores them**. It only uses what the host script sends.
2. **Node host script** (`pnpm nfc:provision --mode basic|424 --stamp-point <id>`; the stamp point is created first, §3.1 step 1)
   - Opens the serial port (`COMx` on Windows; `--port` to override auto-detect).
   - For `--mode 424`: calls the `loyalty-provision-tag` edge function (owner auth) for that stamp point. It **generates the AES keys server-side** and returns them once over HTTPS.
   - Sends the keys to the ESP32.
   - Confirms success, then runs 3 test taps.
3. **NTAG 424 sequence** (AN12196). Do the steps in this order and stop at the first failure:
   1. Select the NDEF application and authenticate with key 0, which is all zeros from the factory (AuthenticateEV2First).
   2. Write the NDEF URL record to file 02. The URL template has placeholders:
      `https://<stamp-domain>/s/<stampPointId>?picc=00000000000000000000000000000000&cmac=0000000000000000`
   3. ChangeFileSettings on file 02:
      - enable SDM;
      - encrypted PICC data (UID + read counter) using key 2 as the SDM meta-read key;
      - CMAC using key 3 as the SDM file-read key;
      - set the PICC data offset and the MAC input/MAC offsets **calculated from where the placeholders sit in the NDEF bytes**;
      - turn on the read counter;
      - set file read access to free (`E`) so any phone can read it.
   4. Change keys 2, 3 and 1 from the defaults to the generated keys.
   5. **Change key 0 last.**
   6. Read the tag back. Simulate a tap by reading the NDEF file and verify the CMAC on the host using the same code as the server (`packages/loyalty-core/nfc/sun.ts`).
4. **Safety (important):**
   - **If key 0 is changed and the key is lost, the tag can never be reconfigured.** The host script must confirm the server has saved the keys (a read-back check) **before** sending ChangeKey for key 0.
   - Add a `--dry-run` flag that does everything except changing keys.
   - **Test the whole flow on a spare tag first.**
   - Never print full keys to the console; mask them (`a1b2…9f`).
5. **Basic tags** (`write_basic`): write a single NDEF URI record. An optional `--lock` flag makes the tag read-only permanently, so it asks for confirmation first.

**Where the keys live:** only in `loyalty.tag_keys`, encrypted with a Supabase secret. Never in the repo, the sketch, logs or the browser.

After programming, use the **"Test tap"** button in the console: tap 3 times and confirm the counter increases and every tap verifies.

---

## 4. Placement checklist (per outlet)

- [ ] The stamp is at the **pickup/payment point**, where the customer naturally holds their phone.
- [ ] There's no metal under or behind it, and no other NFC tag within 10 cm.
- [ ] The QR card sits right next to it, printed at least 6 × 6 cm, matte (not glossy, which glares), and is the **rotating QR on a display** if the café has a spare device.
- [ ] The tap instructions are visible.
- [ ] Tested with: an iPhone, a budget Android phone with NFC on, and a phone without NFC (the QR path).
- [ ] Staff know how to turn on NFC on a customer's Android phone (Settings → Connected devices → NFC) and where the stamp approvals and redemptions show up.

---

## 5. Shopping list for the pilot

| Item | Qty | Note |
|---|---|---|
| NTAG215 stickers/coins (25–30 mm) | 10 | Prototype + demos |
| NTAG 424 DNA tags | 3–5 | Production test; ask the seller about SUN pre-config |
| Stamp body (wood/resin/3D print) | 1 per outlet + 1 demo | Logo on the face |
| Spare Android phone or cheap tablet + stand | 1 per outlet (optional) | Counter display for the rotating QR |
| USB NFC reader (ACR1252U) | 1 (optional) | Only if you configure the 424 tags yourself |
| Printed table tents | 1–2 per outlet | Tap/scan instructions + offer |
