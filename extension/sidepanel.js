// The panel is just the website in an iframe, so there is nothing to wire up.
// The one thing left: Chrome cannot give an extension a theme-aware *toolbar* PNG,
// so ship both marks and pick one from here, where prefers-color-scheme is readable.
const marks = (tone) => ({
  16: `icons/on-${tone}/16.png`,
  32: `icons/on-${tone}/32.png`,
  48: `icons/on-${tone}/48.png`,
  128: `icons/on-${tone}/128.png`,
})

const apply = (dark) => {
  try { chrome.action.setIcon({ path: marks(dark ? 'dark' : 'light') }) } catch { /* not an extension page */ }
}

const query = matchMedia('(prefers-color-scheme: dark)')
apply(query.matches)
query.addEventListener('change', (e) => apply(e.matches))
