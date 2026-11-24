const money = new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED', maximumFractionDigits: 0 });

export const formatMoney = (n) => (n == null ? '–' : money.format(n));

export const formatDate = (d) => (d ? new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '–');

// "just now", "12 min ago", "3 h ago", then the date
export const timeAgo = (d) => {
  if (!d) return '–';
  const min = Math.round((Date.now() - new Date(d)) / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  if (min < 24 * 60) return `${Math.round(min / 60)} h ago`;
  return formatDate(d);
};

// "1 deal", "3 deals"
export const countOf = (n, noun) => `${n} ${noun}${n === 1 ? '' : 's'}`;

// What a deal.view scope covers, in words.
export const SCOPE_TEXT = { own: 'Deals you own', branch: 'Every deal in your branch', all: 'Deals across all branches' };

export const greeting = (date = new Date()) => {
  const h = date.getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

// Same keys as LOST_REASONS in the API's deal model.
export const LOST_REASONS = {
  price: 'Price too high',
  competitor: 'Went with a competitor',
  no_budget: 'No budget',
  timing: 'Bad timing',
  no_response: 'Customer stopped responding',
  other: 'Other',
};

// "sales_manager" -> "Sales Manager"
export const roleLabel = (name) => name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export const formatTime =(d) => (d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');

export function formatDay(d) {
  const date = new Date(d);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

// "2 min", "3 h", "Mon" style relative label for thread lists
export function formatShort(d) {
  if (!d) return '';
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return formatTime(d);
  return new Date(d).toLocaleDateString([], { day: 'numeric', month: 'short' });
}
