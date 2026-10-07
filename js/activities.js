/* Litter Crusaders Maps — car-ride I Spy prompts + home "What's different?" room game. */
(function () {
  'use strict';

  const ISPY = [
    { id: 'red_car', easy: true, emoji: '🚗', prompt: 'something RED that goes vroom', hint: 'A red car!' },
    { id: 'yellow_sign', easy: true, emoji: '🟡', prompt: 'a YELLOW sign', hint: 'Yellow signs slap — keep an eye out.' },
    { id: 'tree', easy: true, emoji: '🌳', prompt: 'a tall TREE', hint: 'Window check — leafy vibes.' },
    { id: 'bird', easy: true, emoji: '🐦', prompt: 'a BIRD (or a bird on a wire)', hint: 'Rooftops + wires = bird spots.' },
    { id: 'bicycle', easy: true, emoji: '🚲', prompt: 'a BICYCLE', hint: 'Parked or rolling, both count. No stress.' },
    { id: 'bus', easy: true, emoji: '🚌', prompt: 'a BUS', hint: 'Big, boxy, full of seats. Can\'t miss it.' },
    { id: 'stop_sign', easy: true, emoji: '🛑', prompt: 'a STOP sign', hint: 'Red octagon. Eight sides. Classic.' },
    { id: 'flower', easy: true, emoji: '🌸', prompt: 'a FLOWER or planter', hint: 'Balconies + gardens are flower magnets.' },
    { id: 'dog_walker', medium: true, emoji: '🐕', prompt: 'a DOG (or dog walker)', hint: 'Waggy tails = auto win.' },
    { id: 'blue_door', medium: true, emoji: '🚪', prompt: 'a BLUE door', hint: 'Slow scan the house fronts.' },
    { id: 'cloud', medium: true, emoji: '☁️', prompt: 'a funny-shaped CLOUD', hint: 'Animal-shaped cloud? Instant points.' },
    { id: 'bridge', medium: true, emoji: '🌉', prompt: 'a BRIDGE', hint: 'Over a road, creek, or tracks.' },
    { id: 'mailbox', medium: true, emoji: '📫', prompt: 'a MAILBOX', hint: 'Usually chilling by the curb.' },
    { id: 'umbrella', medium: true, emoji: '☂️', prompt: 'an UMBRELLA (or someone holding one)', hint: 'Rain day? This one\'s free.' },
    { id: 'flag', medium: true, emoji: '🚩', prompt: 'a FLAG', hint: 'Poles, porches, parks — flag country.' },
    { id: 'truck', medium: true, emoji: '🚚', prompt: 'a delivery TRUCK', hint: 'Big boxes on wheels. Delivery era.' },
    { id: 'fountain', hard: true, emoji: '⛲', prompt: 'a FOUNTAIN or water feature', hint: 'Parks + plazas. Splashy.' },
    { id: 'mural', hard: true, emoji: '🎨', prompt: 'a colorful WALL or mural', hint: 'Bright painted walls hit different.' },
    { id: 'number_7', hard: true, emoji: '7️⃣', prompt: 'the number 7 somewhere', hint: 'Addresses, buses, signs… dig around.' },
    { id: 'rainbow', hard: true, emoji: '🌈', prompt: 'something with a RAINBOW of colors', hint: 'Stickers, shirts, art — rainbow hunt.' }
  ];

  const ROOM_DIFFS = [
    { id: 'sock', emoji: '🧦', prompt: 'a SOCK on the floor', hint: 'Under the bed? Classic sock move.' },
    { id: 'toy', emoji: '🧸', prompt: 'a TOY that moved', hint: 'Did that plushie teleport?' },
    { id: 'book', emoji: '📖', prompt: 'an open BOOK', hint: 'Desk, bed, shelf — somewhere.' },
    { id: 'cup', emoji: '🥤', prompt: 'a CUP or bottle that appeared', hint: 'Cups love appearing outta nowhere.' },
    { id: 'clothes', emoji: '👕', prompt: 'clothes that aren\'t put away', hint: 'Chair? Floor? Doorknob cosplay?' },
    { id: 'light', emoji: '💡', prompt: 'a LIGHT that changed (on/off)', hint: 'Ask a grown-up before flipping switches.' },
    { id: 'curtain', emoji: '🪟', prompt: 'curtains / blinds different', hint: 'Open vs closed both count. Lowkey.' },
    { id: 'pillow', emoji: '🛏️', prompt: 'a PILLOW out of place', hint: 'Beds + couches. Pillow chaos.' },
    { id: 'chair', emoji: '🪑', prompt: 'a CHAIR that moved', hint: 'Spun or yeeted sideways.' },
    { id: 'trash', emoji: '🗑️', prompt: 'something that should go in the BIN', hint: 'Wrappers/tissues — gloves if it\'s icky.' },
    { id: 'shoe', emoji: '👟', prompt: 'a SHOE in a funny spot', hint: 'Hallway? Under the desk? Shoes be wild.' },
    { id: 'drawing', emoji: '✏️', prompt: 'paper / drawing left out', hint: 'Art projects love to wander off.' }
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
