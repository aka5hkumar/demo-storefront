/** Footer Help / Shipping / Returns dialogs (demo content). */
import { $ } from './dom.js';
import { emit } from './events.js';

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
      <section><b>Free exchanges</b>Swap sizes or colours at no cost, while stock lasts.</section>
      <section><b>Refunds</b>Issued to your original payment method within 5 business days of us receiving the return.</section>`,
  },
};

function openInfo(pageId) {
  const page = PAGES[pageId];
  $('#info-title').textContent = page.title;
  $('#info-content').innerHTML = page.body;
  $('#info-modal').hidden = false;
  $('#info-close').focus();
  emit('info_viewed', { page: pageId });
}

function closeInfo() {
  $('#info-modal').hidden = true;
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
