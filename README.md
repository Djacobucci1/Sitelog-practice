# SiteLog practice

Single-file static practice site for SiteLog. It runs in the browser: microphone dictation with the Web Speech API, editable drafts, receipts, a signature pad, PDF export, and `localStorage`. There is no build step.

Live site: https://djacobucci1.github.io/Sitelog-practice/

The microphone works in Chrome, Edge, and Safari. It does not work in Firefox, which does not implement the Web Speech API speech-recognition interface. The page has to be served over HTTPS for the microphone to be available; GitHub Pages provides that.
