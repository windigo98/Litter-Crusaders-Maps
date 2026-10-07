/* Litter Crusaders Maps — car-ride I Spy prompts + home "What's different?" room game. */
(function () {
  'use strict';

  const ISPY = [
    { id: 'red_car', easy: true, emoji: '🚗', prompt: 'something RED that goes vroom', hint: 'A red car!' },
    { id: 'yellow_sign', easy: true, emoji: '🟡', prompt: 'a YELLOW sign', hint: 'Street signs often glow yellow.' },
    { id: 'tree', easy: true, emoji: '🌳', prompt: 'a tall TREE', hint: 'Look out the window for leaves!' },
    { id: 'bird', easy: true, emoji: '🐦', prompt: 'a BIRD (or a bird on a wire)', hint: 'Check rooftops and wires.' },
    { id: 'bicycle', easy: true, emoji: '🚲', prompt: 'a BICYCLE', hint: 'Parked or rolling — both count!' },
    { id: 'bus', easy: true, emoji: '🚌', prompt: 'a BUS', hint: 'Big, boxy, and full of seats.' },
    { id: 'stop_sign', easy: true, emoji: '🛑', prompt: 'a STOP sign', hint: 'Red octagon, eight sides!' },
    { id: 'flower', easy: true, emoji: '🌸', prompt: 'a FLOWER or planter', hint: 'Balconies and gardens love flowers.' },
    { id: 'dog_walker', medium: true, emoji: '🐕', prompt: 'a DOG (or dog walker)', hint: 'Waggy tails welcome!' },
    { id: 'blue_door', medium: true, emoji: '🚪', prompt: 'a BLUE door', hint: 'Scan house fronts carefully.' },
    { id: 'cloud', medium: true, emoji: '☁️', prompt: 'a funny-shaped CLOUD', hint: 'Does it look like an animal?' },
    { id: 'bridge', medium: true, emoji: '🌉', prompt: 'a BRIDGE', hint: 'Over a road, creek, or railway.' },
    { id: 'mailbox', medium: true, emoji: '📫', prompt: 'a MAILBOX', hint: 'Often by the curb.' },
    { id: 'umbrella', medium: true, emoji: '☂️', prompt: 'an UMBRELLA (or someone holding one)', hint: 'Rainy days make this easy!' },
    { id: 'flag', medium: true, emoji: '🚩', prompt: 'a FLAG', hint: 'Poles, porches, and parks.' },
    { id: 'truck', medium: true, emoji: '🚚', prompt: 'a delivery TRUCK', hint: 'Look for big boxes on wheels.' },
    { id: 'fountain', hard: true, emoji: '⛲', prompt: 'a FOUNTAIN or water feature', hint: 'Parks and plazas!' },
    { id: 'mural', hard: true, emoji: '🎨', prompt: 'a colorful WALL or mural', hint: 'Bright painted buildings.' },
    { id: 'number_7', hard: true, emoji: '7️⃣', prompt: 'the number 7 somewhere', hint: 'Addresses, buses, signs…' },
    { id: 'rainbow', hard: true, emoji: '🌈', prompt: 'something with a RAINBOW of colors', hint: 'Stickers, shirts, art…' }
  ];

  const ROOM_DIFFS = [
    { id: 'sock', emoji: '🧦', prompt: 'a SOCK on the floor', hint: 'Peek under the bed!' },
    { id: 'toy', emoji: '🧸', prompt: 'a TOY that moved', hint: 'Was that stuffed animal over there before?' },
    { id: 'book', emoji: '📖', prompt: 'an open BOOK', hint: 'Desk, bed, or shelf.' },
    { id: 'cup', emoji: '🥤', prompt: 'a CUP or bottle that appeared', hint: 'Surfaces love cups.' },
    { id: 'clothes', emoji: '👕', prompt: 'clothes that aren\'t put away', hint: 'Chair? Floor? Door knob?' },
    { id: 'light', emoji: '💡', prompt: 'a LIGHT that changed (on/off)', hint: 'Ask a grown-up before touching switches.' },
    { id: 'curtain', emoji: '🪟', prompt: 'curtains / blinds different', hint: 'Open vs closed counts!' },
    { id: 'pillow', emoji: '🛏️', prompt: 'a PILLOW out of place', hint: 'Beds and couches.' },
    { id: 'chair', emoji: '🪑', prompt: 'a CHAIR that moved', hint: 'Rotated or shoved aside.' },
    { id: 'trash', emoji: '🗑️', prompt: 'something that should go in the BIN', hint: 'Wrappers, tissues — gloves if icky!' },
    { id: 'shoe', emoji: '👟', prompt: 'a SHOE in a funny spot', hint: 'Hallway? Under the desk?' },
    { id: 'drawing', emoji: '✏️', prompt: 'paper / drawing left out', hint: 'Art projects love to wander.' }
  ];

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function shuffle(seed, arr) {
    const a = arr.slice(); let x = hash(seed) || 1;
    for (let i = a.length - 1; i > 0; i--) {
      x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
      const j = x % (i + 1); const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function ispyDeck(profileId, dayKey) {
    return shuffle('ispy:' + dayKey + ':' + profileId, ISPY);
  }
  function roomDeck(profileId, roundId) {
    return shuffle('room:' + profileId + ':' + roundId, ROOM_DIFFS).slice(0, 5);
  }

  window.LMActivities = {
    ISPY: ISPY, ROOM_DIFFS: ROOM_DIFFS,
    ispyDeck: ispyDeck, roomDeck: roomDeck, shuffle: shuffle
  };
})();
