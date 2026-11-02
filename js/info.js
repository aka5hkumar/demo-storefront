/** Footer Help / Shipping / Returns dialogs (demo content). */
import { $ } from './dom.js';
import { emit } from './events.js';
import { openDialog, closeDialog } from './focus.js';

const PAGES = {
  help: {
    title: 'Help',
    body: `
      <section><b>Where is my order?</b>Tracking is emailed as soon as your order ships, usually within 1 business day.</section>
      <section><b>How do your sizes run?</b>True to size. Between sizes? Size up for a relaxed fit.</section>
      <section><b>Contact us</b>help@nanomotion.example · Mon–Fri, 9am–6pm ET</section>`,
  },
  shipping: {
    title: 'Shipping',
    body: `
      <dl>
        <dt>US standard</dt><dd>3–5 business days · free over $100, otherwise $8</dd>
        <dt>US express</dt><dd>1–2 business days · $18</dd>
        <dt>Canada</dt><dd>5–8 business days · duties included</dd>
        <dt>UK &amp; EU</dt><dd>4–7 business days · duties and VAT included</dd>
        <dt>Japan</dt><dd>5–9 business days · duties included</dd>
      </dl>
      <p>We ship to 40+ countries. Prices show in your selected currency at checkout.</p>`,
  },
  returns: {
    title: 'Returns',
    body: `
      <section><b>30-day returns</b>Unworn items with tags can be returned within 30 days of delivery.</section>
      <section><b>Free exchanges</b>Swap sizes or colors at no cost, while stock lasts.</section>
      <section><b>Refunds</b>Issued to your original payment method within 5 business days of us receiving the return.</section>`,
  },
  privacy: {
    title: 'Privacy',
    body: `
      <section><b>What we store on your device</b>
        <code>nm_consent</code> cookie: your cookie choices (180 days).
        Local storage: your currency, cookie choices, saved bag and cart/order reference.
        With advertising consent, a random relay session key expires after 30 days without use.</section>
      <section><b>Advertising measurement</b>
        Only with your permission, an advertising partner's pixel and a server
        relay record which ads led to visits and orders. Contact details from
        checkout and the cart/order reference are hashed (SHA-256) in your browser
        before they are sent.
        Change this any time from Cookie settings.</section>
      <section><b>Services this demo calls</b>
        Opening the bag looks up your approximate location from your IP
        address (ipwho.is or geojs.io), a nearby street (OpenStreetMap) and a
        random demo shopper (randomuser.me) to fill in the checkout form.
        Fonts load from Google Fonts.</section>
      <section><b>Your choices</b>
        Use Cookie settings or Your Privacy Choices in the footer to change
        consent, or Reset cookie consent to start over.</section>`,
  },
};

function openInfo(pageId) {
  const page = PAGES[pageId];
  $('#info-title').textContent = page.title;
  $('#info-content').innerHTML = page.body;
  $('#info-modal').hidden = false;
  openDialog($('#info-modal'), $('#info-close'));
  emit('info_viewed', { page: pageId });
}

function closeInfo() {
  if ($('#info-modal').hidden) return;
  $('#info-modal').hidden = true;
  closeDialog($('#info-modal'));
}

export function initInfoDialogs() {
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-info]');
    if (trigger) openInfo(trigger.dataset.info);
  });

  $('#info-close').addEventListener('click', closeInfo);
  $('#info-modal').addEventListener('click', (event) => {
    if (event.target.id === 'info-modal') closeInfo();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeInfo();
  });
}
