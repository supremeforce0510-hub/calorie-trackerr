# CalorieTrack Installable PWA

CalorieTrack is now a Progressive Web App (PWA).

## Features
- Food log with calories, protein, carbs, and fat
- Daily calorie and protein goals
- Daily summary
- Weight log
- Date-by-date history
- Data saved locally on the device
- Offline app shell via service worker
- Installable home-screen app when served over HTTPS
- JSON backup export

## Important installation note
PWAs cannot be installed directly from a `file://` page opened out of a ZIP. The folder must be served from an HTTPS website (or localhost during development). Upload this folder to any static web host, then open the HTTPS address on the phone and choose Install / Add to Home Screen.

## Android
Open the HTTPS site in Chrome. If the install button is available, tap **Install CalorieTrack**. Otherwise use Chrome menu > **Add to Home screen** / **Install app**.

## iPhone
Open the HTTPS site in Safari, tap Share, then **Add to Home Screen**.
