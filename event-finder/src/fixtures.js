/**
 * Deterministic, entirely synthetic demo data. No real events or venues.
 * @type {import('./events.js').Event[]}
 */
export const EVENTS = [
  ['sample-jazz', 'Jazz in the courtyard', '2026-11-06', '18:30', 'Juniper Courtyard', 'Music', 'A fictional evening of mellow jazz.'],
  ['sample-clay', 'Clay, coffee and company', '2026-11-07', '10:00', 'Studio No. 4', 'Arts', 'Try imaginary pottery shapes at a friendly demo workshop.'],
  ['sample-walk', 'The slow Sunday walk', '2026-11-08', '09:00', 'Maple Loop', 'Outdoors', 'A fictional gentle walk beside the river.'],
  ['sample-code', 'Creative coding circle', '2026-11-07', '14:00', 'Pixel Hall', 'Tech', 'Explore playful coding ideas in this synthetic meetup.'],
  ['sample-stories', 'Stories after sunset', '2026-11-12', '19:00', 'Reading Room', 'Community', 'Share imaginary stories with a fictional neighbourhood group.'],
  ['sample-print', 'Print something playful', '2026-11-14', '13:00', 'Paperhouse Studio', 'Arts', 'A synthetic introduction to bold paper prints.'],
  ['sample-market', 'A taste of the neighbourhood', '2026-11-15', '11:00', 'Orchard Square', 'Food', 'Browse fictional seasonal food stalls.'],
  ['sample-picnic', 'Garden picnic club', '2026-11-08', '12:00', 'Clover Garden', 'Food', 'An imaginary picnic celebrating shared recipes.'],
  ['sample-synth', 'Synth sounds evening', '2026-11-14', '18:00', 'Echo Room', 'Music', 'Listen to fictional electronic music performances.'],
  ['sample-repair', 'Curious gadgets lab', '2026-11-15', '14:00', 'Circuit Workshop', 'Tech', 'A synthetic hands-on gathering about everyday gadgets.'],
  ['sample-birds', 'Birdsong morning', '2026-11-21', '08:30', 'Willow Trail', 'Outdoors', 'An imaginary introduction to listening for birds.'],
  ['sample-swap', 'Neighbourhood book swap', '2026-11-21', '11:00', 'Lantern Hall', 'Community', 'Exchange imaginary reading recommendations at a demo gathering.'],
].map(([id, title, date, startTime, venue, topic, description]) => ({
  id,
  title: `[SYNTHETIC SAMPLE] ${title}`,
  description: `Synthetic sample only. ${description}`,
  date,
  startTime,
  venue: `Sample venue: ${venue}`,
  topic: /** @type {import('./events.js').Topic} */ (topic),
  synthetic: true,
}));
