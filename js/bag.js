/**
 * Bag drawer and the simulated checkout.
 * Steps: bag → contact → shipping → payment → confirmation.
 */
import { $, $$ } from './dom.js';
import { state } from './state.js';
import { emit, on } from './events.js';
import { formatPrice, shippingCost } from './currency.js';
import { COLORS, CARD_BACKGROUNDS, GENDER_LABELS, findProduct } from './catalog.js';
import { garmentMarkup } from './garment.js';
import { getSelection } from './selection.js';

const CHECKOUT_STEPS = [
  { id: 'bag',      title: 'Your Bag',  nextLabel: 'Checkout →' },
  { id: 'contact',  title: 'Contact',   nextLabel: 'Continue to shipping →' },
  { id: 'shipping', title: 'Shipping',  nextLabel: 'Continue to payment →' },
  { id: 'payment',  title: 'Payment',   nextLabel: 'Place order' },
  { id: 'done',     title: 'Thank you' },
];

export function initBag() {
  $('#bag-button').addEventListener('click', openBag);
  $('#bag-close').addEventListener('click', closeBag);
  $('#bag-scrim').addEventListener('click', closeBag);
  $('#bag-body').addEventListener('click', handleBagClick);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeBag();
  });

  on('currency_changed', renderBag);
  renderBag();
}

/* ----- Bag contents ----- */

const lineKey = (sku, color, size) => `${sku}|${color}|${size}`;

/** Bag lines joined with their product data. */
function bagLines() {
  return [...state.bag.entries()].map(([key, line]) => ({
    key,
    ...line,
    product: findProduct(line.sku),
  }));
}

function subtotal() {
  return bagLines().reduce(
    (sum, line) => sum + line.product.prices[state.currency] * line.quantity,
    0,
  );
}

function itemCount() {
  return bagLines().reduce((sum, line) => sum + line.quantity, 0);
}

/** Tracking payload for one unit of a bag line. */
function lineTrackingDetails(product, color, size) {
  return {
    sku: product.sku,
    name: product.name,
    category: product.category,
    gender: product.gender,
    color,
    size,
    quantity: 1,
    unit_price: product.prices[state.currency],
  };
}

/** Add one unit of a product, in its currently selected colour and size, then open the bag. */
export function addToBag(product, source) {
  const { color, size } = getSelection(product);
  const key = lineKey(product.sku, color, size);
  const line = state.bag.get(key) ?? { sku: product.sku, color, size, quantity: 0 };

  line.quantity += 1;
  state.bag.set(key, line);

  emit('add_to_cart', { ...lineTrackingDetails(product, color, size), source });
  bumpBagButton();

  state.checkoutStep = 0;
  openBag();
}

function changeQuantity(key, delta) {
  const line = state.bag.get(key);
  if (!line) return;

  const product = findProduct(line.sku);
  line.quantity += delta;
  if (line.quantity <= 0) state.bag.delete(key);

  const eventName = delta > 0 ? 'add_to_cart' : 'remove_from_cart';
  emit(eventName, { ...lineTrackingDetails(product, line.color, line.size), source: 'bag_quantity' });
  renderBag();
}

/* ----- Drawer ----- */

export function openBag() {
  document.body.classList.add('bag-is-open');
  $('#bag-drawer').setAttribute('aria-hidden', 'false');
  renderBag();
  emit('cart_opened', { subtotal: subtotal() });
}

export function closeBag() {
  document.body.classList.remove('bag-is-open');
  $('#bag-drawer').setAttribute('aria-hidden', 'true');
}

function bumpBagButton() {
  const button = $('#bag-button');
  button.classList.remove('is-bumping');
  void button.offsetWidth; // restart the CSS animation
  button.classList.add('is-bumping');
}

/* ----- Rendering ----- */

function renderBag() {
  const step = CHECKOUT_STEPS[state.checkoutStep];

  $('#bag-count').textContent = itemCount();
  $('#bag-title').textContent = step.title;
  $$('#checkout-progress li').forEach((item, index) => {
    item.classList.toggle('is-reached', index <= state.checkoutStep);
  });

  const stepMarkup = {
    bag: bagStepMarkup,
    contact: contactStepMarkup,
    shipping: shippingStepMarkup,
    payment: paymentStepMarkup,
    done: confirmationMarkup,
  }[step.id];

  $('#bag-body').innerHTML = stepMarkup();
}

function totalsMarkup({ nextLabel, nextDisabled = false }) {
  const itemsTotal = subtotal();
  const shipping = shippingCost(itemsTotal, state.currency);
  const backButton = state.checkoutStep > 0
    ? '<button type="button" class="checkout-back" data-checkout-back>← Back</button>'
    : '';

  return `
    <div class="bag-totals">
      <div class="bag-totals__row"><span>Subtotal</span><span>${formatPrice(itemsTotal, state.currency)}</span></div>
      <div class="bag-totals__row"><span>Shipping</span><span>${shipping ? formatPrice(shipping, state.currency) : 'Free'}</span></div>
      <div class="bag-totals__row bag-totals__row--total"><span>Total</span><span>${formatPrice(itemsTotal + shipping, state.currency)}</span></div>
      <button type="button" class="checkout-next" data-checkout-next ${nextDisabled ? 'disabled' : ''}>${nextLabel}</button>
      ${backButton}
      <p class="checkout-note">Demo store · no real payment taken</p>
    </div>`;
}

function bagStepMarkup() {
  const lines = bagLines();

  const linesMarkup = lines.length
    ? lines.map(bagLineMarkup).join('')
    : '<p class="bag-empty">Your bag is empty. Tap + Add on any product.</p>';

  return linesMarkup + totalsMarkup({ nextLabel: CHECKOUT_STEPS[0].nextLabel, nextDisabled: !lines.length });
}

function bagLineMarkup({ key, product, color, size, quantity }) {
  return `
    <div class="bag-line">
      <span class="bag-line__thumb" style="background: ${CARD_BACKGROUNDS[product.background]}">
        ${garmentMarkup(product, color)}
      </span>
      <div class="bag-line__info">
        <b>${product.name}</b>
        <small>${GENDER_LABELS[product.gender]} · ${COLORS[color].label} · ${size}</small>
        <span class="quantity">
          <button type="button" data-decrease="${key}" aria-label="Remove one">−</button>
          ${quantity}
          <button type="button" data-increase="${key}" aria-label="Add one">+</button>
        </span>
      </div>
      <span class="bag-line__price">${formatPrice(product.prices[state.currency] * quantity, state.currency)}</span>
    </div>`;
}

function contactStepMarkup() {
  return `
    <form class="checkout-form">
      <label for="checkout-email">Email<input id="checkout-email" type="email" required value="alex@example.com"></label>
      <label for="checkout-name">Full name<input id="checkout-name" required value="Alex Rivera"></label>
    </form>
    ${totalsMarkup({ nextLabel: CHECKOUT_STEPS[1].nextLabel })}`;
}

function shippingStepMarkup() {
  return `
    <form class="checkout-form">
      <label for="checkout-address">Address<input id="checkout-address" required value="214 Dekalb Ave"></label>
      <div class="checkout-form__row">
        <label for="checkout-city">City<input id="checkout-city" required value="Brooklyn"></label>
        <label for="checkout-postcode">Postal code<input id="checkout-postcode" required value="11205"></label>
      </div>
      <label for="checkout-country">Country
        <select id="checkout-country">
          <option>United States</option>
          <option>Canada</option>
          <option>United Kingdom</option>
          <option>Germany</option>
          <option>Japan</option>
        </select>
      </label>
    </form>
    ${totalsMarkup({ nextLabel: CHECKOUT_STEPS[2].nextLabel })}`;
}

function paymentStepMarkup() {
  return `
    <form class="checkout-form">
      <label for="checkout-card">Card number<input id="checkout-card" inputmode="numeric" value="4242 4242 4242 4242"></label>
      <div class="checkout-form__row">
        <label for="checkout-expiry">Expiry<input id="checkout-expiry" value="12/28"></label>
        <label for="checkout-cvc">CVC<input id="checkout-cvc" value="123"></label>
      </div>
    </form>
    ${totalsMarkup({ nextLabel: CHECKOUT_STEPS[3].nextLabel })}`;
}

function confirmationMarkup() {
  return `
    <div class="order-confirmation">
      <div class="display">Order placed</div>
      <p>Order ${state.orderId}<br>A confirmation would go to your email.</p>
    </div>
    <button type="button" class="checkout-next" data-keep-shopping>Keep shopping</button>`;
}

/* ----- Checkout navigation ----- */

function placeOrder() {
  state.orderId = `NM-${Date.now().toString(36).toUpperCase()}`;

  emit('order_placed', {
    id: state.orderId, // stable id so a server-side copy can be deduplicated
    items: bagLines().map(({ product, color, size, quantity }) => ({
      sku: product.sku,
      color,
      size,
      quantity,
      unit_price: product.prices[state.currency],
    })),
    total: subtotal(),
  });
}

function goToNextStep() {
  const form = $('#bag-body form');
  if (form && !form.reportValidity()) return;

  if (CHECKOUT_STEPS[state.checkoutStep].id === 'payment') placeOrder();

  state.checkoutStep += 1;
  const nextStep = CHECKOUT_STEPS[state.checkoutStep];
  if (nextStep.id !== 'done') emit('checkout_step', { step: nextStep.id });

  renderBag();
}

function handleBagClick(event) {
  const button = event.target.closest('button');
  if (!button) return;
  const data = button.dataset;

  if (data.increase) changeQuantity(data.increase, +1);
  if (data.decrease) changeQuantity(data.decrease, -1);

  if ('checkoutNext' in data) goToNextStep();

  if ('checkoutBack' in data) {
    state.checkoutStep -= 1;
    renderBag();
  }

  if ('keepShopping' in data) {
    state.bag.clear();
    state.checkoutStep = 0;
    renderBag();
    closeBag();
  }
}
